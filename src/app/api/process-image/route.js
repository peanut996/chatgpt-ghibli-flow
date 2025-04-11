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
import {
  PromptType,
  defaultPrompts,
  TELEGRAM_BOT_TOKEN,
  PROXY,
  SMTP_HOST,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  SMTP_PORT,
  TELEGRAM_CHAT_ID,
  COOKIES_PATH,
  SMTP_SECURE,
  EMAIL_REGEX_BACKEND,
  HEADLESS_MODE,
  GENERATION_TIMEOUT,
  UPLOAD_TIMEOUT,
} from './config.js';

const queue = new PQueue({ concurrency: 1 });

let _bot = null;

const getBot = () => {
  if (_bot) {
    return _bot;
  }
  if (TELEGRAM_BOT_TOKEN) {
    try {
      _bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
        polling: false,
        ...(PROXY && { request: { PROXY } }),
      });
    } catch (error) {
      console.error(chalk.red('❌ 初始化 Telegram Bot 失败:'), error.message);
    }
  } else {
    console.warn(
      chalk.yellow('⚠️ 未提供 TELEGRAM_BOT_TOKEN，Telegram 通知功能将不可用。'),
    );
  }
  return _bot;
};


let _transporter = null;
const getTransporter = () => {
  if (_transporter) {
    return _transporter;
  }
  if (SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM) {
    try {
      _transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
        ...(PROXY && { proxy: PROXY }),
      });
      _transporter.verify((error, _) => {
        if (error) {
          console.error(chalk.red('❌ 初始化 Nodemailer 失败:'), error);
          _transporter = null;
        } else {
          console.log(chalk.green('✅ Nodemailer (Email) 服务已准备就绪。'));
        }
      });
    } catch (error) {
      console.error(
        chalk.red('❌ 创建 Nodemailer _transporter 时出错:'),
        error,
      );
    }
  } else {
    console.warn(
      chalk.yellow(
        '⚠️ 已启用邮件通知 (ENABLE_EMAIL_NOTIFICATIONS=true) 但缺少必要的 SMTP 配置 (HOST, USER, PASS, FROM)。邮件功能将不可用。',
      ),
    );
  }
  return _transporter;
};

const sendToTelegram = async (
  isSuccess,
  imageUrl,
  description = '',
  promptUsed = '',
) => {
  if (!getBot()) {
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
    let msg = isSuccess
      ? `✅ ${description}\n${promptLabel}`
      : `❌ ${description}\n${promptLabel}`;

    if (imageUrl) {
      await getBot().sendPhoto(TELEGRAM_CHAT_ID, imageUrl, {
        parse_mode: 'Markdown',
        caption: msg,
      });
    } else {
      await getBot().sendMessage(TELEGRAM_CHAT_ID, msg, {
        parse_mode: 'Markdown',
      });
    }

    console.log(chalk.green(`✅ [后台][TG] 发送处理结果已发送到 Telegram。`));
  } catch (error) {
    console.error(
      chalk.red(`❌ [后台][TG] 发送处理结果到 Telegram 失败:`),
      error,
    );
  }
};

const sendToEmail = async (
  isSuccess,
  content,
  recipientEmail,
  originalFilename = '',
  promptUsed = '',
) => {
  if (!getTransporter() || !recipientEmail) {
    if (recipientEmail && !getTransporter()) {
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
    let info = await getTransporter().sendMail(mailOptions);
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
    await page.waitForSelector(fileInputSelector, { timeout: UPLOAD_TIMEOUT });
    const fileInput = await page.$(fileInputSelector);
    await fileInput.uploadFile(uploadedFilePath);
    await countdown('等待文件上传完成', 15000);

    await page.type('textarea', finalPromptToUse, { delay: 50 });
    await countdown('等待输入完成', 5000);
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

    await countdown('生成已结束，获取结果中...', 5000);

    let imageElement = null;
    const imageSelector = 'img[alt="Generated image"]';
    try {
      await page.waitForSelector(imageSelector, { timeout: 10000 });
      imageElement = await page.$(imageSelector);
    } catch (e) {
      console.warn(
        chalk.yellow(`⏳ 等待图像元素超时，尝试获取第一个图像元素。`),
      );

      const errorMessage = await page.evaluate(() => {
        const assistantMessages = Array.from(
          document.querySelectorAll('[data-message-author-role="assistant"]'),
        );
        const lastMessage = assistantMessages[assistantMessages.length - 1];
        return lastMessage ? lastMessage.textContent.trim() : '未知错误';
      });

      console.error(chalk.red(`❌ 页面错误消息: ${errorMessage}`));

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
        originalFileUrl,
        `[${originalFilename}](${originalFileUrl}) \n\n🙅 原因：${errorMessage}`,
        finalPromptToUse,
      );
      sendToEmail(
        false,
        '❌ 未找到生成的图像: ' + errorMessage,
        recipientEmail,
        originalFilename,
      );
      return;
    }

    const imageUrl = await page.evaluate((el) => el.src, imageElement);
    console.log(chalk.green(`✅ 提取到图像 URL: ${imageUrl}`));

    const desc = `[${originalFilename}](${imageUrl})`;
    sendToTelegram(true, imageUrl, desc, finalPromptToUse);
    sendToEmail(
      true,
      imageUrl,
      recipientEmail,
      originalFilename,
      finalPromptToUse,
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      chalk.red(`❌ [后台] 处理 ${originalFilename} 时出错:`),
      errorMsg,
      error.stack,
    );
    const err = `[${originalFilename}](${imageUrl}) \n\n❌ 错误: ${errorMsg}`;
    sendToTelegram(false, null, err, finalPromptToUse);
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
      const emailNotice = recipientEmail ? ` -> ${recipientEmail}` : '';
      const msg = `⏳ 正在处理任务: ${originalFilename}  ${emailNotice} (队列剩余任务：${queue.pending + queue.size})`;

      if (getBot() && TELEGRAM_CHAT_ID) {
        try {
          const tgMsg = `⏳ 正在处理任务: ${originalFilename} (队列剩余任务：${queue.pending + queue.size})`;
          await getBot().sendMessage(TELEGRAM_CHAT_ID, tgMsg);
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
      sendToTelegram(
        false,
        null,
        `队列任务处理失败: ${errorMsg}`,
        finalPromptToUse,
      );
    });
}

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

    receivedPromptType = promptTypeFromRequest || PromptType.GHIBLI;
    console.log(chalk.blue(`ℹ️ 请求的 Prompt 类型: ${receivedPromptType}`));

    finalPromptToUse =
      defaultPrompts[receivedPromptType] || defaultPrompts[PromptType.GHIBLI];

    if (
      receivedPromptType === PromptType.CUSTOM &&
      customPromptTextFromRequest
    ) {
      finalPromptToUse = customPromptTextFromRequest;
    }

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

    sendToTelegram(false, null, `API 错误: ${errorMsg}`);

    return NextResponse.json(
      {
        success: false,
        error: errorMsg || '处理上传时发生内部服务器错误。',
      },
      { status: 500 },
    );
  }
}