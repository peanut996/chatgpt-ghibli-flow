import PQueue from 'p-queue';
import {
  sendMessageToTelegram,
  sendToTelegram,
} from '@/app/api/process-image/telegram.js';
import chalk from 'chalk';
import { processImageInBackground } from '@/app/api/process-image/browser.js';
import logger from '@/app/api/logger.js';

let _queue;

export function addToProcessQueue(
  uploadedFilePath,
  originalFilename,
  finalPromptToUse,
  recipientEmail,
) {
  getQueue()
    .add(async () => {
      const emailNotice = recipientEmail ? ` -> ${recipientEmail}` : '';
      const msg = `⏳ 正在处理任务: ${originalFilename}  ${emailNotice} \n\n🎯 队列剩余${getQueueSize()}个任务`;

      logger.info(msg);
      sendMessageToTelegram(msg);

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

export const getQueue = () => {
  if (_queue) {
    return _queue;
  }
  _queue = new PQueue({ concurrency: 1 });
  return _queue;
};

export const getQueueSize = () => {
  return _queue ? _queue.size + _queue.pending : 0;
};
