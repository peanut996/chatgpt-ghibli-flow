import {
  PROXY,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
} from '@/app/api/process-image/config.js';
import chalk from 'chalk';
import TelegramBot from 'node-telegram-bot-api';
import logger from '@/app/api/process-image/logger.js';

process.env.NTBA_FIX_319 = 1;
process.env.NTBA_FIX_350 = 0;

let _bot = null;

export const getBot = () => {
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

export const sendToTelegram = async (
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

export const trySendPhotoOrMessage = async (
  photoPath,
  message,
  originalFilename,
) => {
  if (!getBot()) {
    return;
  }
  if (!TELEGRAM_CHAT_ID) {
    logger.error(chalk.red('❌ 环境变量中未设置 TELEGRAM_CHAT_ID。'));
    return;
  }
  let success = false;
  try {
    await getBot().sendPhoto(
      TELEGRAM_CHAT_ID,
      photoPath,
      {
        caption: message,
      },
      {
        filename: originalFilename,
      },
    );
    success = true;
  } catch (error) {
    logger.error(chalk.red(`❌ [后台][TG] 发送图片到 Telegram 失败:`), error);
  }
  if (success) {
    return;
  }

  try {
    await getBot().sendMessage(TELEGRAM_CHAT_ID, message);
  } catch (error) {
    logger.error(chalk.red(`❌ [后台][TG] 发送消息到 Telegram 失败:`), error);
  }
};
