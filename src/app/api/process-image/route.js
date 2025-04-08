import { NextResponse } from "next/server";
import puppeteer from "puppeteer-extra";
import path from "path";
import fs from "fs/promises";
import os from "os";
import crypto from "crypto";
import TelegramBot from "node-telegram-bot-api";
import chalk from "chalk";
import PQueue from 'p-queue';
import { PromptType, defaultPrompts } from './config.js';

// --- Configuration ---
const COOKIES_PATH = path.resolve(
    process.env.COOKIES_FILE_PATH || "./cookies.json",
);
const proxy = process.env.PROXY || '';
const HEADLESS_MODE = process.env.HEADLESS !== "false";
const UPLOAD_TIMEOUT = parseInt(process.env.UPLOAD_TIMEOUT || "20000", 10);
const GENERATION_TIMEOUT = parseInt(
    process.env.GENERATION_TIMEOUT || "240000", // 4 minutes
    10,
);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Initialize PQueue
const queue = new PQueue({concurrency: 1});

// --- Telegram Bot Setup ---
let bot = null;
if (TELEGRAM_BOT_TOKEN) {
    try {
        bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
            polling: false,
            ...(proxy && { request: { proxy } }),
        });
    } catch (error) {
        console.error(chalk.red("❌ 初始化 Telegram Bot 失败:"), error.message);
    }
} else {
    console.warn(
        chalk.yellow("⚠️ 未提供 TELEGRAM_BOT_TOKEN，Telegram 通知功能将不可用。"),
    );
}

// --- sendToTelegram Function ---
const sendToTelegram = async (isSuccess, content, caption = "", promptUsed = "") => {
    if (!bot) {
        console.error(chalk.red("❌ Telegram Bot 未初始化。无法发送消息。"));
        return;
    }
    if (!TELEGRAM_CHAT_ID) {
        console.error(chalk.red("❌ 环境变量中未设置 TELEGRAM_CHAT_ID。"));
        return;
    }
    try {
        const promptLabel = promptUsed ? `\n📟 Prompt: ${promptUsed}` : "\n(仅上传图片)";
        if (isSuccess) {
            console.log(chalk.blue(`✉️ [后台] 发送图片 URL 到 Telegram: ${TELEGRAM_CHAT_ID}`));
            const fullCaption = `[🔗 ${caption}](${content})${promptLabel}`;
            await bot.sendPhoto(TELEGRAM_CHAT_ID, content, {
                parse_mode: "Markdown",
                caption: fullCaption,
            });
            console.log(chalk.green(`✅ [后台] 图片 URL 已成功发送到 Telegram。`));
        } else {
            console.log(chalk.blue(`✉️ [后台] 发送错误消息到 Telegram: ${TELEGRAM_CHAT_ID}`));
            const errorMessage = `❌ 处理失败: ${content}\n文件名: ${caption || "未知"}${promptLabel}`;
            await bot.sendMessage(TELEGRAM_CHAT_ID, errorMessage.substring(0, 4096)); // TG message limit
            console.log(chalk.green(`✅ [后台] 错误消息已发送到 Telegram。`));
        }
    } catch (error) {
        console.error(chalk.red(`❌ [后台] 发送消息到 Telegram 失败:`), error);
    }
};

// --- Puppeteer 浏览器实例管理 ---
let browserInstance = null;
let isBrowserLaunching = false;

async function getBrowser() {
    if (browserInstance) {
        try {
            // Quick check if browser is still connected
            await browserInstance.version();
            console.log(chalk.gray(" puppeteer: 重用现有浏览器实例。"));
            return browserInstance;
        } catch (e) {
            console.warn(chalk.yellow(" puppeteer: 浏览器似乎已断开连接，正在启动新的实例。"));
            try { await browserInstance.close(); } catch (_) {}
            browserInstance = null;
        }
    }
    if (isBrowserLaunching) {
        console.log(chalk.gray(" puppeteer: 等待浏览器启动..."));
        while (isBrowserLaunching) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (!browserInstance) throw new Error("等待后浏览器实例仍为 null");
        return browserInstance;
    }
    isBrowserLaunching = true;
    console.log(
        chalk.blue(
            `🚀 puppeteer: 正在启动新浏览器 (Headless: ${HEADLESS_MODE})...`,
        ),
    );
    try {
        console.log(chalk.gray(" Dynamically importing StealthPlugin..."));
        console.log(chalk.green(" StealthPlugin imported."));
        console.log(chalk.blue(" Applying StealthPlugin before launch..."));
        const StealthPlugin = (await import("puppeteer-extra-plugin-stealth"))
            .default;
        puppeteer.use(StealthPlugin());
        console.log(chalk.green(" StealthPlugin applied."));

        const newBrowser = await puppeteer.launch({
            headless: HEADLESS_MODE,
            defaultViewport: null,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu",
            ],
        });
        console.log(chalk.green("✅ puppeteer: 浏览器启动成功。"));

        if (
            !(await fs
                .access(COOKIES_PATH)
                .then(() => true)
                .catch(() => false))
        ) {
            console.error(chalk.red(`❌ Cookies 文件未找到: ${COOKIES_PATH}`));
            await newBrowser.close();
            throw new Error(`Cookies 文件未找到于 ${COOKIES_PATH}`);
        } else {
            console.log(chalk.blue(`🍪 正在从以下位置加载 cookies: ${COOKIES_PATH}`));
            const cookiesData = await fs.readFile(COOKIES_PATH, "utf-8");
            const cookies = JSON.parse(cookiesData);
            const tempPage = await newBrowser.newPage();
            if (Array.isArray(cookies)) {
                await tempPage.setCookie(...cookies);
            } else {
                console.warn(
                    chalk.yellow(`⚠️ Cookies 文件格式似乎不正确，期望是一个数组。`),
                );
            }
            await tempPage.close();
            console.log(chalk.green("✅ Cookies 加载完成。"));
        }

        browserInstance = newBrowser;
        isBrowserLaunching = false;
        return browserInstance;
    } catch (error) {
        console.error(chalk.red("❌ puppeteer: 启动或初始化浏览器失败:"), error);
        isBrowserLaunching = false;
        browserInstance = null;
        throw error;
    }
}

async function countdown(label, durationMs) {
    if (durationMs <= 0) return; // Skip if duration is zero or negative

    const interval = 1000;
    let remaining = durationMs;

    const formatTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
        const seconds = String(totalSeconds % 60).padStart(2, "0");
        return `${minutes}:${seconds}`;
    };

    const writeOutput = (text) => {
        if (process.stdout.isTTY) {
            process.stdout.clearLine?.(0);
            process.stdout.cursorTo?.(0);
            process.stdout.write(text);
        } else {
            console.log(text);
        }
    };

    writeOutput(chalk.yellow(`🧙 ${label}（剩余 ${formatTime(remaining)}）`));

    return new Promise((resolve) => {
        const timer = setInterval(() => {
            remaining -= interval;
            if (process.stdout.isTTY) {
                writeOutput(chalk.yellow(`⏳ ${label}（剩余 ${formatTime(remaining)}）`));
            }

            if (remaining <= 0) {
                clearInterval(timer);
                if (process.stdout.isTTY) {
                    process.stdout.write("\n");
                }
                resolve();
            }
        }, interval);
    });
}

// --- processImageInBackground Function ---
async function processImageInBackground(uploadedFilePath, originalFilename, finalPromptToUse) {
    console.log(
        chalk.cyan(
            `--- [后台] 开始处理: ${originalFilename} (使用 Prompt: ${finalPromptToUse || '无'}) ---`,
        ),
    );
    let browser = null;
    let page = null;

    try {
        browser = await getBrowser();
        page = await browser.newPage();
        await page.goto("https://chatgpt.com/?model=gpt-4o", { waitUntil: "networkidle2", timeout: 90000 }); // Longer timeout, specify model?
        console.log(chalk.green(`📤 处理图片: ${originalFilename}`));

        const fileInputSelector = 'input[type="file"]';
        await page.waitForSelector(fileInputSelector);
        const fileInput = await page.$(fileInputSelector);
        await fileInput.uploadFile(uploadedFilePath);
        await countdown("等待文件上传完成", 15000);

        await page.type("textarea", finalPromptToUse, {delay: 50});
        await countdown("等待输入完成", 5000);
        await page.keyboard.press("Enter");


        const stopGeneratingSelector = 'button[aria-label*="Stop streaming"]';
        try {
            console.log(chalk.gray(`⏳  等待生成完成指示器消失...`));
            await page.waitForSelector(stopGeneratingSelector, { hidden: true, timeout: GENERATION_TIMEOUT });
            console.log(chalk.green(`⏳  生成完成指示器已消失。`));
        } catch (e) {
            console.warn(chalk.yellow(`⏳  等待生成完成指示器超时 (${GENERATION_TIMEOUT/1000}s)，将继续检查图像。`));
        }

        await countdown("图像已生成，请稍等...", 5000);

        let imageElement = null;
        const imageSelector = 'img[alt="Generated image"]';
        try {
            await page.waitForSelector(imageSelector, { timeout: 10000 });
            imageElement = await page.$(imageSelector);
        } catch (e) {
            console.warn(chalk.yellow(`⏳  等待图像元素超时，尝试获取第一个图像元素。`));
            const imageUrls = await page.$$eval("img", (imgs) =>
                imgs
                    .map((img) => img.src)
                    .filter((src) => src.startsWith("blob:") || src.startsWith("https") || src.includes("files.oaiusercontent.com"))
            );
            const originalFileUrl = imageUrls[imageUrls.length - 1];
            console.error(chalk.red("❌ 未找到生成的图像元素。"));
            await sendToTelegram(false, originalFileUrl, originalFilename, finalPromptToUse);
            return;
        }

        const imageUrl = await page.evaluate(el => el.src, imageElement);
        console.log(chalk.green(`✅ 找到图像 URL: ${imageUrl.substring(0, 100)}...`));

        const caption = `${originalFilename}`;
        await sendToTelegram(true, imageUrl, caption, finalPromptToUse);
    } catch (error) {
        console.error(chalk.red(`❌ [后台] 处理 ${originalFilename} 时出错:`), error);
        await sendToTelegram(false, error.message, originalFilename, finalPromptToUse);
    } finally {
        console.log(chalk.gray(`  [后台] 关闭页面 ${originalFilename}...`));
        if (page && !page.isClosed()) {
            try { await page.close(); } catch (closeError) { console.error("Error closing page:", closeError); }
        }
        if (uploadedFilePath) {
            try {
                await fs.unlink(uploadedFilePath);
                console.log(
                    chalk.gray(`🗑️ [后台] 已清理临时文件: ${uploadedFilePath}`),
                );
            } catch (cleanupError) {
                console.error(
                    chalk.yellow(`⚠️ [后台] 清理临时文件 ${uploadedFilePath} 失败:`),
                    cleanupError,
                );
            }
        }
        console.log(chalk.cyan(`--- [后台] 处理完成: ${originalFilename} ---`));
    }
}

// --- addToProcessQueue Function ---
function addToProcessQueue(uploadedFilePath, originalFilename, finalPromptToUse) {
    queue.add(async () => {
        const promptSnippet = finalPromptToUse ? `(${finalPromptToUse.substring(0, 30)}...)` : '(仅图片)';
        const msg = `⏳ 处理任务加入队列: ${originalFilename} ${promptSnippet} (队列中还有 ${queue.size} 个任务)`;
        if (bot && TELEGRAM_CHAT_ID) {
            try {
                await bot.sendMessage(TELEGRAM_CHAT_ID, msg);
            } catch (tgError) {
                console.error(chalk.red('❌ 发送队列消息到Telegram失败:'), tgError);
            }
        }
        console.log(chalk.blue(msg));

        await processImageInBackground(uploadedFilePath, originalFilename, finalPromptToUse);
    }).catch((error) => {
        console.error(chalk.red("💥 [队列] 处理任务时发生顶层错误:"), error);
        sendToTelegram(
            false,
            `队列任务处理失败: ${error instanceof Error ? error.message : String(error)}`,
            originalFilename,
            finalPromptToUse
        );
    });
}

// --- API Route Handler ---
export async function POST(req) {
    if (req.method !== "POST") {
        return NextResponse.json(
            { success: false, error: `方法 ${req.method} 不允许` },
            { status: 405, headers: { Allow: "POST" } },
        );
    }
    console.log(chalk.cyan(`\n--- 收到新请求 (Enum Type) ---`));
    let tempFilePath = null;
    let receivedPromptType = PromptType.GHIBLI; // Default value
    let finalPromptToUse = defaultPrompts[PromptType.GHIBLI]; // Default prompt text

    try {
        const formData = await req.formData();
        const imageFile = formData.get("image");

        // Read promptType and customPromptText
        const promptTypeFromRequest = formData.get("promptType")?.toString();
        const customPromptTextFromRequest = formData.get("customPromptText")?.toString();

        if (!imageFile || !(imageFile instanceof File)) {
            console.error(chalk.red("❌ 请求中未找到 'image' 文件字段或类型不正确。"));
            return NextResponse.json({ success: false, error: "请求中缺少 'image' 文件字段。" },{ status: 400 });
        }

        const originalFilename = imageFile.name || `upload_${Date.now()}`;
        console.log(chalk.blue(`📄 收到文件: ${originalFilename}, 类型: ${imageFile.type}, 大小: ${imageFile.size} bytes`));

        // Determine the final prompt based on type
        receivedPromptType = promptTypeFromRequest || PromptType.GHIBLI; // Default to Ghibli if not provided
        console.log(chalk.blue(`ℹ️ 请求的 Prompt 类型: ${receivedPromptType}`));

        switch (receivedPromptType) {
            case PromptType.GHIBLI:
                finalPromptToUse = defaultPrompts[PromptType.GHIBLI];
                break;
            case PromptType.CAT_HUMAN:
                finalPromptToUse = defaultPrompts[PromptType.CAT_HUMAN];
                break;
            case PromptType.IRASUTOYA:
                finalPromptToUse = defaultPrompts[PromptType.IRASUTOYA];
                break;
            case PromptType.CUSTOM:
                if (!customPromptTextFromRequest?.trim()) {
                    console.error(chalk.red(`❌ 收到 'custom' 类型但未收到有效的 'customPromptText'`));
                    return NextResponse.json({ success: false, error: "选择了自定义 Prompt 但未提供文本。" }, { status: 400 });
                }
                finalPromptToUse = customPromptTextFromRequest;
                console.log(chalk.blue(`📝 使用自定义 Prompt: "${finalPromptToUse}"`));
                break;
            default:
                // Handle unexpected type - default to Ghibli
                console.warn(chalk.yellow(`⚠️ 未知的 Prompt 类型 "${receivedPromptType}", 使用默认 Ghibli。`));
                receivedPromptType = PromptType.GHIBLI;
                finalPromptToUse = defaultPrompts[PromptType.GHIBLI];
        }

        // Sanitize filename before creating path
        const safeOriginalFilename = path.basename(originalFilename).replace(/[^a-zA-Z0-9.\-_]/g, '_'); // Basic sanitize
        const fileBuffer = Buffer.from(await imageFile.arrayBuffer());
        const tempDir = os.tmpdir();
        const uniqueSuffix = crypto.randomBytes(6).toString("hex");
        tempFilePath = path.join(tempDir, `ghibliflow-${Date.now()}-${uniqueSuffix}-${safeOriginalFilename}`);

        console.log(chalk.gray(`  写入临时文件到: ${tempFilePath}`));
        await fs.writeFile(tempFilePath, fileBuffer);
        console.log(chalk.green(`✅ 临时文件写入成功。`));

        console.log(chalk.green(`✅ 文件接收并保存成功，添加到处理队列。`));

        addToProcessQueue(tempFilePath, originalFilename, finalPromptToUse);

        return NextResponse.json(
            {
                success: true,
                message: "文件已加入处理队列。请稍后查看 Telegram。",
                originalFilename: originalFilename,
                queueSize: queue.size + queue.pending, // More accurate queue size
                promptTypeUsed: receivedPromptType, // Return the type enum key used
                finalPromptUsed: finalPromptToUse // Return the actual prompt text used
            },
            { status: 200 },
        );
    } catch (error) {
        console.error(chalk.red("❌ API 处理程序错误 (文件接收/解析阶段):"), error);
        if (tempFilePath) {
            await fs.unlink(tempFilePath).catch(cleanupError =>
                console.error(chalk.yellow(`⚠️ [API错误后] 清理临时文件 ${tempFilePath} 失败:`), cleanupError)
            );
        }
        // Send error to Telegram if possible
        // Note: finalPromptToUse might be the default if error happened early
        await sendToTelegram(false, `API 错误: ${error.message || '未知错误'}`, 'API 请求失败', finalPromptToUse);

        return NextResponse.json(
            { success: false, error: error.message || "处理上传时发生内部服务器错误。" },
            { status: 500 }
        );
    }
}