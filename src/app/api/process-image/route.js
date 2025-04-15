import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import crypto from 'crypto';
import { defaultPrompts, EMAIL_REGEX_BACKEND, PromptType } from './config.js';
import { sendToTelegram } from '@/app/api/process-image/telegram.js';
import {
  addToProcessQueue,
  getQueueSize,
} from '@/app/api/process-image/queue.js';
import logger from '@/app/api/process-image/logger.js';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req) {
  const authHeader = req.headers.get('Authorization');
  const session = await getServerSession(authOptions);
  if (authHeader !== `Bearer ${process.env.NEXTAUTH_SECRET}` && !session) {
    logger.warn('🚫 [API] 未经授权尝试处理图片。');
    return NextResponse.json(
      { success: false, error: '未授权，请先登录。' },
      { status: 401 },
    );
  }
  const userIdentifier =
    session.user.email || session.user.name || session.user.id || '未知用户';
  logger.info(`--- 收到来自用户 ${userIdentifier} 的新请求 ---`);

  if (req.method !== 'POST') {
    logger.warn(
      `[API] 不允许的方法: ${req.method} (来自用户: ${userIdentifier})`,
    );
    return NextResponse.json(
      { success: false, error: `方法 ${req.method} 不允许` },
      { status: 405, headers: { Allow: 'POST' } },
    );
  }

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
      logger.error("请求中缺少 'image' 文件字段。");
      return NextResponse.json(
        { success: false, error: "请求中缺少 'image' 文件字段。" },
        { status: 400 },
      );
    }

    if (emailFromRequest && !EMAIL_REGEX_BACKEND.test(emailFromRequest)) {
      logger.error(`❌ 无效的邮箱地址格式: ${emailFromRequest}`);
      return NextResponse.json(
        { success: false, error: '提供的邮箱地址格式无效。' },
        { status: 400 },
      );
    }

    const originalFilename = imageFile.name || `upload_${Date.now()}`;
    logger.info(
      `📄 收到文件: ${originalFilename}, 类型: ${imageFile.type}, 大小: ${imageFile.size} bytes ${emailFromRequest ? `(邮箱: ${emailFromRequest})` : ''}`,
    );

    receivedPromptType = promptTypeFromRequest || PromptType.GHIBLI;
    logger.info(`ℹ️ 请求的 Prompt 类型: ${receivedPromptType}`);

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

    logger.debug(`写入临时文件到: ${tempFilePath}`);
    await fs.writeFile(tempFilePath, fileBuffer);
    logger.info(`✅ 临时文件写入成功。`);

    logger.info(`✅ 文件接收并保存成功，添加到处理队列。`);

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
    logger.error('❌ API 处理程序错误 (文件接收/解析阶段):', error);
    if (tempFilePath) {
      await fs
        .unlink(tempFilePath)
        .catch((cleanupError) =>
          logger.warn(
            `⚠️ [API错误后] 清理临时文件 ${tempFilePath} 失败:`,
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
