import { NextResponse } from "next/server";
import puppeteer from "puppeteer-extra";
import path from "path";
import fs from "fs/promises";
import os from "os";
import crypto from "crypto";
import TelegramBot from "node-telegram-bot-api";
import chalk from "chalk";
import PQueue from 'p-queue';

// --- Configuration ---
const COOKIES_PATH = path.resolve(
    process.env.COOKIES_FILE_PATH || "./cookies.json",
);
const PROMPT =
    "请将这张图片转换为吉卜力风格的图像。去除右下角文字，保持原来图像的长宽比";
const proxy = process.env.PROXY;
const HEADLESS_MODE = process.env.HEADLESS !== "false";
const UPLOAD_TIMEOUT = parseInt(process.env.UPLOAD_TIMEOUT || "20000", 10);
const INPUT_TIMEOUT = parseInt(process.env.INPUT_TIMEOUT || "5000", 10);
const GENERATION_TIMEOUT = parseInt(
    process.env.GENERATION_TIMEOUT || "240000",
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
const sendToTelegram = async (isSuccess, content, caption = "") => {
    if (!bot) {
        console.error(chalk.red("❌ Telegram Bot 未初始化。无法发送消息。"));
        return;
    }
    if (!TELEGRAM_CHAT_ID) {
        console.error(chalk.red("❌ 环境变量中未设置 TELEGRAM_CHAT_ID。"));
        return;
    }
    try {
        if (isSuccess) {
            console.log(
                chalk.blue(
                    `✉️ [后台] 正在发送图片 URL 到 Telegram Chat ID: ${TELEGRAM_CHAT_ID}`,
                ),
            );
            await bot.sendPhoto(TELEGRAM_CHAT_ID, content, { caption });
            console.log(chalk.green(`✅ [后台] 图片 URL 已成功发送到 Telegram。`));
        } else {
            console.log(
                chalk.blue(
                    `✉️ [后台] 正在发送错误消息到 Telegram Chat ID: ${TELEGRAM_CHAT_ID}`,
                ),
            );
            const errorMessage = `❌ 处理失败: ${content}\n文件名: ${caption || "未知"}`;
            await bot.sendMessage(TELEGRAM_CHAT_ID, errorMessage.substring(0, 4096));
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
            await browserInstance.version();
            console.log(chalk.gray(" puppeteer: 重用现有浏览器实例。"));
            return browserInstance;
        } catch (e) {
            console.warn(
                chalk.yellow(" puppeteer: 浏览器似乎已断开连接，正在启动新的实例。"),
            );
            try {
                await browserInstance.close();
            } catch (_) {}
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
            if(process.stdout.isTTY){
                writeOutput(chalk.yellow(`🧙 ${label}（剩余 ${formatTime(remaining)}）`));
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
async function processImageInBackground(uploadedFilePath, originalFilename) {
    console.log(
        chalk.cyan(
            `--- [后台] 开始处理: ${originalFilename} (Temp: ${uploadedFilePath}) ---`,
        ),
    );
    let browser = null;
    let page = null;

    try {
        browser = await getBrowser();
        page = await browser.newPage();
        await page.goto("https://chatgpt.com", { waitUntil: "networkidle2" });
        console.log(chalk.green(`📤 处理图片: ${originalFilename}`));

        const fileInputSelector = 'input[type="file"]';
        await page.waitForSelector(fileInputSelector);
        const fileInput = await page.$(fileInputSelector);
        await fileInput.uploadFile(uploadedFilePath);
        await countdown("等待文件上传完成", 15000);

        await page.type("textarea", PROMPT);
        await countdown("等待输入完成", 5000);
        await page.keyboard.press("Enter");

        await countdown("正在生成吉卜力图像，请稍等...", 180000);

        const imageUrls = await page.$$eval("img", (imgs) =>
            imgs
                .map((img) => img.src)
                .filter((src) => src.startsWith("blob:") || src.startsWith("https")),
        );

        if (imageUrls.length === 0) {
            console.log(chalk.red("⚠️ 未找到生成图像，跳过。"));
            await page.close();
            return;
        }

        const imageUrl = imageUrls[imageUrls.length - 1];
        console.log(chalk.green(`📥 下载图像: ${imageUrl}`));

        const caption = `🎨 ${originalFilename}`;
        await sendToTelegram(true, imageUrl, caption);
    } catch (error) {
        console.error(
            chalk.red(`❌ [后台] 处理 ${originalFilename} 时出错:`),
            error,
        );
        await sendToTelegram(false, error.message, originalFilename);
    } finally {
        console.log(chalk.gray(`  [后台] 关闭页面 ${originalFilename}...`));
        if (page && !page.isClosed()) {
            await page.close();
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

// Add queue processing function
function addToProcessQueue(uploadedFilePath, originalFilename) {
    queue.add(async () => {
        console.log(chalk.blue(`📋 开始处理队列任务: ${originalFilename} (队列中还有 ${queue.size} 个任务)`));
        await processImageInBackground(uploadedFilePath, originalFilename);
    }).catch((error) => {
        console.error(
            chalk.red("💥 [队列] 处理任务时发生错误:"),
            error
        );
        sendToTelegram(
            false,
            `队列任务处理失败: ${error instanceof Error ? error.message : String(error)}`,
            originalFilename
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
    console.log(
        chalk.cyan(`\n--- 收到新请求 (App Router / JS / No Formidable) ---`),
    );
    let tempFilePath = null;

    try {
        const formData = await req.formData();
        const imageFile = formData.get("image");

        if (!imageFile || !(imageFile instanceof File)) {
            console.error(
                chalk.red("❌ 请求中未找到 'image' 文件字段或类型不正确。"),
            );
            return NextResponse.json(
                { success: false, error: "请求中缺少 'image' 文件字段。" },
                { status: 400 },
            );
        }
        const originalFilename = imageFile.name || `upload_${Date.now()}`;
        console.log(
            chalk.blue(
                `📄 收到文件: ${originalFilename}, 类型: ${imageFile.type}, 大小: ${imageFile.size} bytes`,
            ),
        );

        const fileBuffer = Buffer.from(await imageFile.arrayBuffer());
        const tempDir = os.tmpdir();
        const uniqueSuffix = crypto.randomBytes(6).toString("hex");
        tempFilePath = path.join(
            tempDir,
            `ghibliflow-${Date.now()}-${uniqueSuffix}-${originalFilename}`,
        );

        console.log(chalk.gray(`  写入临时文件到: ${tempFilePath}`));
        await fs.writeFile(tempFilePath, fileBuffer);
        console.log(chalk.green(`✅ 临时文件写入成功。`));

        console.log(
            chalk.green(`✅ 文件接收并保存成功，添加到处理队列。`),
        );

        addToProcessQueue(tempFilePath, originalFilename);

        return NextResponse.json(
            {
                success: true,
                message: "文件已加入处理队列。请稍后查看 Telegram。",
                originalFilename: originalFilename,
                queueSize: queue.size
            },
            { status: 200 },
        );
    } catch (error) {
        console.error(chalk.red("❌ API 处理程序错误 (文件接收/保存阶段):"), error);
        if (tempFilePath) {
            console.log(
                chalk.yellow(`  尝试清理因错误未处理的临时文件: ${tempFilePath}`),
            );
            await fs
                .unlink(tempFilePath)
                .catch((cleanupError) =>
                    console.error(
                        chalk.yellow(`⚠️ [API错误后] 清理临时文件 ${tempFilePath} 失败:`),
                        cleanupError,
                    ),
                );
        }
        const statusCode = 500;
        const message = error.message || "处理上传时发生内部服务器错误。";
        return NextResponse.json(
            { success: false, error: message },
            { status: statusCode },
        );
    }
}