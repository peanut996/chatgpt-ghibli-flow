import {
  PROXY,
  SMTP_FROM,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
} from '@/app/api/process-image/config.js';
import nodemailer from 'nodemailer';
import chalk from 'chalk';

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

export const sendToEmail = async (
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
