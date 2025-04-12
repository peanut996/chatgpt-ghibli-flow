import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import crypto from 'crypto';
import chalk from 'chalk';
import { defaultPrompts, EMAIL_REGEX_BACKEND, PromptType } from './config.js';
import { sendToTelegram } from '@/app/api/process-image/telegram.js';
import {
  addToProcessQueue,
  getQueueSize,
} from '@/app/api/process-image/queue.js';
import logger from '@/app/api/process-image/logger.js';

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
        queueSize: getQueueSize(),
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
