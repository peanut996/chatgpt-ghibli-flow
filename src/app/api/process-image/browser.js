import chalk from 'chalk';
import {
  COOKIES_PATH,
  GENERATION_TIMEOUT,
  HEADLESS_MODE,
  UPLOAD_TIMEOUT,
} from '@/app/api/process-image/config.js';
import puppeteer from 'puppeteer-extra';
import fs from 'fs/promises';
import { countdown } from '@/app/api/process-image/util.js';
import { sendToTelegram } from '@/app/api/process-image/telegram.js';
import { sendToEmail } from '@/app/api/process-image/mail.js';

let browserInstance = null;
let isBrowserLaunching = false;

export async function getBrowser() {
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

export async function processImageInBackground(
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

      await Promise.allSettled([
        sendToTelegram(
          false,
          originalFileUrl,
          `[${originalFilename}](${originalFileUrl}) \n\n🙅 原因：${errorMessage}`,
          finalPromptToUse,
        ),
        sendToEmail(
          false,
          '❌ 未找到生成的图像: ' + errorMessage,
          recipientEmail,
          originalFilename,
        ),
      ]);
      return;
    }

    const imageUrl = await page.evaluate((el) => el.src, imageElement);
    console.log(chalk.green(`✅ 提取到图像 URL: ${imageUrl}`));

    const desc = `[${originalFilename}](${imageUrl})`;

    await Promise.allSettled([
      sendToTelegram(true, imageUrl, desc, finalPromptToUse),
      sendToEmail(
        true,
        imageUrl,
        recipientEmail,
        originalFilename,
        finalPromptToUse,
      ),
    ]);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      chalk.red(`❌ [后台] 处理 ${originalFilename} 时出错:`),
      errorMsg,
      error.stack,
    );
    const err = `❌ 错误: ${errorMsg}`;
    await Promise.allSettled([
      sendToTelegram(false, null, err, finalPromptToUse),
      sendToEmail(false, err, recipientEmail, originalFilename),
    ]);
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
