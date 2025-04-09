import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-extra';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import crypto from 'crypto';
import TelegramBot from 'node-telegram-bot-api';
import nodemailer from 'nodemailer';
import chalk from 'chalk';
import PQueue from 'p-queue';
import { PromptType, defaultPrompts } from './config.js';

// --- Configuration ---
const COOKIES_PATH = path.resolve(
  process.env.COOKIES_FILE_PATH || './cookies.json',
);
const proxy = process.env.PROXY || '';
const HEADLESS_MODE = process.env.HEADLESS !== 'false';
const UPLOAD_TIMEOUT = parseInt(process.env.UPLOAD_TIMEOUT || '20000', 10);
const GENERATION_TIMEOUT = parseInt(
  process.env.GENERATION_TIMEOUT || '240000', // 4 minutes
  10,
);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// --- NEW: Email Configuration ---
const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = 587;
const SMTP_SECURE = false; // Use true for port 465, false for 587
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = 'GhibliFlow Bot <no-reply@example.com>';
const EMAIL_REGEX_BACKEND = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Backend validation regex

// Initialize PQueue
const queue = new PQueue({ concurrency: 1 });

// --- Telegram Bot Setup ---
let bot = null;
if (TELEGRAM_BOT_TOKEN) {
  try {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
      polling: false,
      ...(proxy && { request: { proxy } }),
    });
  } catch (error) {
    console.error(chalk.red('❌ 初始化 Telegram Bot 失败:'), error.message);
  }
} else {
  console.warn(
    chalk.yellow('⚠️ 未提供 TELEGRAM_BOT_TOKEN，Telegram 通知功能将不可用。'),
  );
}

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM) {
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS, // Consider using App Passwords for Gmail
      },
      ...(proxy && { proxy: proxy }),
    });
    // Verify connection configuration
    transporter.verify((error, success) => {
      if (error) {
        console.error(chalk.red('❌ 初始化 Nodemailer 失败:'), error);
        transporter = null; // Disable email if verification fails
      } else {
        console.log(chalk.green('✅ Nodemailer (Email) 服务已准备就绪。'));
      }
    });
  } catch (error) {
    console.error(chalk.red('❌ 创建 Nodemailer transporter 时出错:'), error);
  }
} else {
  console.warn(
    chalk.yellow(
      '⚠️ 已启用邮件通知 (ENABLE_EMAIL_NOTIFICATIONS=true) 但缺少必要的 SMTP 配置 (HOST, USER, PASS, FROM)。邮件功能将不可用。',
    ),
  );
}

// --- sendToTelegram Function (Keep as is) ---
const sendToTelegram = async (
  isSuccess,
  content,
  caption = '',
  promptUsed = '',
) => {
  if (!bot) {
    return;
  }
  if (!TELEGRAM_CHAT_ID) {
    console.error(chalk.red('❌ 环境变量中未设置 TELEGRAM_CHAT_ID。'));
    return;
  }
  try {
    const promptLabel = promptUsed
      ? `\n📟 Prompt: ${promptUsed}`
      : '\n(仅上传图片)';
    if (isSuccess) {
      console.log(
        chalk.blue(
          `✉️ [后台][TG] 发送图片 URL 到 Telegram: ${TELEGRAM_CHAT_ID}`,
        ),
      );
      const fullCaption = `[🔗 ${caption}](${content})${promptLabel}`;
      await bot.sendPhoto(TELEGRAM_CHAT_ID, content, {
        parse_mode: 'Markdown',
        caption: fullCaption,
      });
      console.log(
        chalk.green(`✅ [后台][TG] 图片 URL 已成功发送到 Telegram。`),
      );
    } else {
      console.log(
        chalk.blue(
          `✉️ [后台][TG] 发送错误消息到 Telegram: ${TELEGRAM_CHAT_ID}`,
        ),
      );
      const errorMessage = `❌ 处理失败: ${content}
${promptLabel}`;
      await bot.sendMessage(TELEGRAM_CHAT_ID, errorMessage, {
        parse_mode: 'Markdown',
      }); // TG message limit
      console.log(chalk.green(`✅ [后台][TG] 错误消息已发送到 Telegram。`));
    }
  } catch (error) {
    console.error(chalk.red(`❌ [后台][TG] 发送消息到 Telegram 失败:`), error);
  }
};

const sendToEmail = async (
  isSuccess,
  content, // URL for success, error message for failure
  recipientEmail,
  originalFilename = '',
  promptUsed = '',
) => {
  if (!transporter || !recipientEmail) {
    if (recipientEmail && !transporter) {
      console.warn(
        chalk.yellow(
          `⚠️ 尝试发送邮件到 ${recipientEmail} 但 Nodemailer 未初始化或配置错误。`,
        ),
      );
    }
    return;
  }

  const subject = isSuccess
    ? `✅ GhibliFlow Studio - 处理成功 - ${originalFilename}`
    : `❌ GhibliFlow Studio - 处理失败 - ${originalFilename}`;

  let htmlBody = '';
  if (isSuccess) {
    htmlBody = `
      <h1 align="center">GhibliFlow Studio</h1>
      <p>文件 <strong>${originalFilename}</strong> 已成功处理。</p>
      <p>🔗 <a href="${content}">下载链接</a> </p>
      <p><small>‼️请尽快保存图片，以防下载链接过期</small></p>
      <img src="${content}" alt="Generated Image" style="max-width: 400px; height: auto; border: 1px solid #ccc; margin-top: 10px;" />
    `;
  } else {
    htmlBody = `
      <h1 align="center">GhibliFlow Studio</h1>
      <p>处理文件 <strong>${originalFilename || '未知'}</strong> 时遇到错误。</p>
      <p>错误详情:</p>
      <pre style="background-color: #fcecec; border: 1px solid #fcc; padding: 10px; border-radius: 4px;">${content}</pre>
      <p><small>尝试使用的 Prompt: ${promptUsed || '无'}</small></p>
    `;
  }

  const mailOptions = {
    from: SMTP_FROM,
    to: recipientEmail,
    subject: subject,
    html: htmlBody,
  };

  try {
    console.log(
      chalk.blue(`✉️ [后台][Email] 正在发送结果到邮箱: ${recipientEmail}`),
    );
    let info = await transporter.sendMail(mailOptions);
    console.log(
      chalk.green(
        `✅ [后台][Email] 邮件已成功发送到 ${recipientEmail}. Message ID: ${info.messageId}`,
      ),
    );
  } catch (error) {
    console.error(
      chalk.red(`❌ [后台][Email] 发送邮件到 ${recipientEmail} 失败:`),
      error,
    );
  }
};

// --- Puppeteer 浏览器实例管理 (Keep as is) ---
let browserInstance = null;
let isBrowserLaunching = false;
async function getBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.version();
      console.log(chalk.gray(' puppeteer: 重用现有浏览器实例。'));
      return browserInstance;
    } catch (e) {
      console.warn(
        chalk.yellow(' puppeteer: 浏览器似乎已断开连接，正在启动新的实例。'),
      );
      try {
        await browserInstance.close();
      } catch (_) {}
      browserInstance = null;
    }
  }
  if (isBrowserLaunching) {
    console.log(chalk.gray(' puppeteer: 等待浏览器启动...'));
    while (isBrowserLaunching) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!browserInstance) throw new Error('等待后浏览器实例仍为 null');
    return browserInstance;
  }
  isBrowserLaunching = true;
  console.log(
    chalk.blue(
      `🚀 puppeteer: 正在启动新浏览器 (Headless: ${HEADLESS_MODE})...`,
    ),
  );
  try {
    console.log(chalk.gray(' Dynamically importing StealthPlugin...'));
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth'))
      .default;
    puppeteer.use(StealthPlugin());
    console.log(chalk.green(' StealthPlugin applied.'));

    const newBrowser = await puppeteer.launch({
      headless: HEADLESS_MODE,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });
    console.log(chalk.green('✅ puppeteer: 浏览器启动成功。'));

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
      const cookiesData = await fs.readFile(COOKIES_PATH, 'utf-8');
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
      console.log(chalk.green('✅ Cookies 加载完成。'));
    }

    browserInstance = newBrowser;
    isBrowserLaunching = false;
    return browserInstance;
  } catch (error) {
    console.error(chalk.red('❌ puppeteer: 启动或初始化浏览器失败:'), error);
    isBrowserLaunching = false;
    browserInstance = null;
    throw error;
  }
}

async function countdown(label, durationMs) {
  if (durationMs <= 0) return;
  const interval = 1000;
  let remaining = durationMs;
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
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
        writeOutput(
          chalk.yellow(`⏳ ${label}（剩余 ${formatTime(remaining)}）`),
        );
      }
      if (remaining <= 0) {
        clearInterval(timer);
        if (process.stdout.isTTY) {
          process.stdout.write('\n');
        }
        resolve();
      }
    }, interval);
  });
}

async function processImageInBackground(
  uploadedFilePath,
  originalFilename,
  finalPromptToUse,
  recipientEmail,
) {
  console.log(
    chalk.cyan(
      `--- [后台] 开始处理: ${originalFilename} (Prompt: ${finalPromptToUse || '无'}) ${recipientEmail ? `(通知邮箱: ${recipientEmail})` : ''} ---`,
    ),
  );
  let browser = null;
  let page = null;

  try {
    browser = await getBrowser();
    page = await browser.newPage();
    await page.goto('https://chatgpt.com/?model=gpt-4o', {
      waitUntil: 'networkidle2',
      timeout: 90000,
    });
    console.log(chalk.green(`📤 处理图片: ${originalFilename}`));

    const fileInputSelector = 'input[type="file"]';
    await page.waitForSelector(fileInputSelector, { timeout: UPLOAD_TIMEOUT }); // Use configured timeout
    const fileInput = await page.$(fileInputSelector);
    await fileInput.uploadFile(uploadedFilePath);
    await countdown('等待文件上传完成', 15000); // Consider making this configurable too

    await page.type('textarea', finalPromptToUse, { delay: 50 });
    await countdown('等待输入完成', 5000); // Consider making this configurable
    await page.keyboard.press('Enter');

    const stopGeneratingSelector = 'button[aria-label*="Stop streaming"]';
    try {
      console.log(chalk.gray(`⏳ 等待生成完成指示器消失...`));
      await page.waitForSelector(stopGeneratingSelector, {
        hidden: true,
        timeout: GENERATION_TIMEOUT,
      });
      console.log(chalk.green(`✅ 生成完成指示器已消失。`));
    } catch (e) {
      console.warn(
        chalk.yellow(
          `⏳ 等待生成完成指示器超时 (${GENERATION_TIMEOUT / 1000}s)，将继续检查图像。`,
        ),
      );
    }

    await countdown('图像已生成，请稍等...', 5000);

    let imageElement = null;
    const imageSelector = 'img[alt="Generated image"]';
    try {
      await page.waitForSelector(imageSelector, { timeout: 10000 });
      imageElement = await page.$(imageSelector);
    } catch (e) {
      console.warn(
        chalk.yellow(`⏳  等待图像元素超时，尝试获取第一个图像元素。`),
      );
      const imageUrls = await page.$$eval('img', (imgs) =>
        imgs
          .map((img) => img.src)
          .filter(
            (src) =>
              src.startsWith('blob:') ||
              src.startsWith('https') ||
              src.includes('files.oaiusercontent.com'),
          ),
      );
      const originalFileUrl = imageUrls[imageUrls.length - 1];
      console.error(chalk.red('❌ 未找到生成的图像元素。'));
      sendToTelegram(
        false,
        `[${originalFilename}](${originalFileUrl})`,
        originalFilename,
        finalPromptToUse,
      ).catch((err) => {
        console.error(chalk.red(`❌ 发送错误消息到 Telegram 失败:`), err);
      });
      sendToEmail(
        false,
        '❌ 未找到生成的图像',
        recipientEmail,
        originalFilename,
      ).catch((err) => {
        console.log(
          chalk.red(`❌ 发送错误消息到 ${recipientEmail} 失败:`),
          err,
        );
      });
      return;
    }

    const imageUrl = await page.evaluate((el) => el.src, imageElement);
    console.log(chalk.green(`✅ 提取到图像 URL: ${imageUrl}...`));

    const caption = `${originalFilename}`;
    sendToTelegram(true, imageUrl, caption, finalPromptToUse).catch((err) => {
      console.error(
        chalk.red(
          `❌ 提取成功但发送 Telegram 消息失败: ${originalFilename} -- ${imageUrl}`,
        ),
        err,
      );
    });
    sendToEmail(
      true,
      imageUrl,
      recipientEmail,
      originalFilename,
      finalPromptToUse,
    ).catch((err) => {
      console.error(
        chalk.red(
          `❌ 提取成功但发送邮件失败: ${originalFilename} -- ${imageUrl}`,
        ),
        err,
      );
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      chalk.red(`❌ [后台] 处理 ${originalFilename} 时出错:`),
      errorMsg, // Log the message
      error.stack, // Log the stack for more details if needed
    );
    sendToTelegram(false, errorMsg, originalFilename, finalPromptToUse).catch(
      (error) => {
        console.error(chalk.red(`❌ 发送错误消息到 Telegram 失败:`), error);
      },
    );
  } finally {
    console.log(chalk.gray(`  [后台] 关闭页面 ${originalFilename}...`));
    if (page && !page.isClosed()) {
      try {
        await page.close();
      } catch (closeError) {
        console.error('Error closing page:', closeError);
      }
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

function addToProcessQueue(
  uploadedFilePath,
  originalFilename,
  finalPromptToUse,
  recipientEmail,
) {
  queue
    .add(async () => {
      const promptSnippet = finalPromptToUse;
      const emailNotice = recipientEmail ? ` -> ${recipientEmail}` : '';
      const msg = `⏳ 处理任务加入队列: ${originalFilename}  ${emailNotice} (队列剩余任务：${queue.pending + queue.size})`;

      // Send queue message to Telegram (optional, keep if useful)
      if (bot && TELEGRAM_CHAT_ID) {
        try {
          // Avoid sending email address to Telegram group for privacy
          const tgMsg = `⏳ 处理任务加入队列: ${originalFilename} (队列剩余任务：${queue.pending + queue.size})`;
          await bot.sendMessage(TELEGRAM_CHAT_ID, tgMsg);
        } catch (tgError) {
          console.error(chalk.red('❌ 发送队列消息到Telegram失败:'), tgError);
        }
      }
      console.log(chalk.blue(msg));

      await processImageInBackground(
        uploadedFilePath,
        originalFilename,
        finalPromptToUse,
        recipientEmail,
      );
    })
    .catch((error) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('💥 [队列] 处理任务时发生顶层错误:'), error);
      // Send error notifications
      sendToTelegram(
        false,
        `队列任务处理失败: ${errorMsg}`,
        originalFilename,
        finalPromptToUse,
      ).then((err) => {
        if (err) {
          console.error(chalk.red('❌ 发送队列错误消息到 Telegram 失败:'), err);
        }
      });
    });
}

// --- API Route Handler ---
export async function POST(req) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { success: false, error: `方法 ${req.method} 不允许` },
      { status: 405, headers: { Allow: 'POST' } },
    );
  }
  console.log(chalk.cyan(`\n--- 收到新请求 ---`));
  let tempFilePath = null;
  let receivedPromptType = PromptType.GHIBLI;
  let finalPromptToUse = defaultPrompts[PromptType.GHIBLI];
  let emailFromRequest = null;

  try {
    const formData = await req.formData();
    const imageFile = formData.get('image');
    const promptTypeFromRequest = formData.get('promptType')?.toString();
    const customPromptTextFromRequest = formData
      .get('customPromptText')
      ?.toString();
    emailFromRequest = formData.get('email')?.toString() || null;

    if (!imageFile || !(imageFile instanceof File)) {
      return NextResponse.json(
        { success: false, error: "请求中缺少 'image' 文件字段。" },
        { status: 400 },
      );
    }

    if (emailFromRequest && !EMAIL_REGEX_BACKEND.test(emailFromRequest)) {
      console.error(chalk.red(`❌ 无效的邮箱地址格式: ${emailFromRequest}`));
      return NextResponse.json(
        { success: false, error: '提供的邮箱地址格式无效。' },
        { status: 400 },
      );
    }

    const originalFilename = imageFile.name || `upload_${Date.now()}`;
    console.log(
      chalk.blue(
        `📄 收到文件: ${originalFilename}, 类型: ${imageFile.type}, 大小: ${imageFile.size} bytes ${emailFromRequest ? `(邮箱: ${emailFromRequest})` : ''}`,
      ),
    );

    // Determine the final prompt based on type
    receivedPromptType = promptTypeFromRequest || PromptType.GHIBLI;
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
          return NextResponse.json(
            { success: false, error: '选择了自定义 Prompt 但未提供文本。' },
            { status: 400 },
          );
        }
        finalPromptToUse = customPromptTextFromRequest;
        console.log(chalk.blue(`📝 使用自定义 Prompt: "${finalPromptToUse}"`));
        break;
      default:
        console.warn(
          chalk.yellow(
            `⚠️ 未知的 Prompt 类型 "${receivedPromptType}", 使用默认 Ghibli。`,
          ),
        );
        receivedPromptType = PromptType.GHIBLI;
        finalPromptToUse = defaultPrompts[PromptType.GHIBLI];
    }

    // Save temp file
    const safeOriginalFilename = path
      .basename(originalFilename)
      .replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const fileBuffer = Buffer.from(await imageFile.arrayBuffer());
    const tempDir = os.tmpdir();
    const uniqueSuffix = crypto.randomBytes(6).toString('hex');
    tempFilePath = path.join(
      tempDir,
      `ghibliflow-${Date.now()}-${uniqueSuffix}-${safeOriginalFilename}`,
    );

    console.log(chalk.gray(`  写入临时文件到: ${tempFilePath}`));
    await fs.writeFile(tempFilePath, fileBuffer);
    console.log(chalk.green(`✅ 临时文件写入成功。`));

    console.log(chalk.green(`✅ 文件接收并保存成功，添加到处理队列。`));

    addToProcessQueue(
      tempFilePath,
      originalFilename,
      finalPromptToUse,
      emailFromRequest,
    );

    const successMessage = `文件已加入处理队列。请稍后查看 Telegram ${emailFromRequest ? `和邮箱 ${emailFromRequest}` : ''}。`;
    return NextResponse.json(
      {
        success: true,
        message: successMessage,
        originalFilename: originalFilename,
        queueSize: queue.size + queue.pending,
        promptTypeUsed: receivedPromptType,
        finalPromptUsed: finalPromptToUse,
        emailProvided: !!emailFromRequest,
      },
      { status: 200 },
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('❌ API 处理程序错误 (文件接收/解析阶段):'), error);
    if (tempFilePath) {
      await fs
        .unlink(tempFilePath)
        .catch((cleanupError) =>
          console.error(
            chalk.yellow(`⚠️ [API错误后] 清理临时文件 ${tempFilePath} 失败:`),
            cleanupError,
          ),
        );
    }

    sendToTelegram(
      false,
      `API 错误: ${errorMsg}`,
      'API 请求失败',
      finalPromptToUse,
    ).catch((err) => {
      console.error(chalk.red('❌ 发送错误消息到 Telegram 失败:'), err);
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMsg || '处理上传时发生内部服务器错误。',
      },
      { status: 500 },
    );
  }
}
