import path from 'path';

export const PromptType = {
  GHIBLI: 'ghibli',
  CAT_HUMAN: 'cat-human',
  IRASUTOYA: 'irasutoya',
  STICKER: 'sticker',
  CUSTOM: 'custom',
};

export const defaultPrompts = {
  [PromptType.GHIBLI]:
    process.env.PROMPT_GHIBLI ||
    '请将这张图片转换为吉卜力风格的图像。去除右下角文字，保持原来图像的长宽比',
  [PromptType.CAT_HUMAN]:
    process.env.PROMPT_CAT_HUMAN ||
    '请将这张图片中的猫咪模拟成人类。去除右下角文字，保持原来图像的长宽比',
  [PromptType.IRASUTOYA]:
    process.env.PROMPT_IRASUTOYA ||
    '生成日本小人(类似于irasutoyo)风格，去除右下角文字，保持原来图像的长宽比',
  [PromptType.STICKER]:
    process.env.PROMPT_STICKER ||
    '把我变成一个可爱的二次元，sticker set吧，2x2的4宫格，四个常用的表情包',
};

export const COOKIES_PATH = path.resolve(
  process.env.COOKIES_FILE_PATH || './cookies.json',
);
export const PROXY = process.env.PROXY || '';
export const HEADLESS_MODE = process.env.HEADLESS !== 'false';
export const UPLOAD_TIMEOUT = parseInt(
  process.env.UPLOAD_TIMEOUT || '20000',
  10,
);
export const GENERATION_TIMEOUT = parseInt(
  process.env.GENERATION_TIMEOUT || '240000',
  10,
);
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export const SMTP_HOST = 'smtp.gmail.com';
export const SMTP_PORT = 587;
export const SMTP_SECURE = false;
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;
export const SMTP_FROM = 'GhibliFlow Bot <no-reply@example.com>';
export const EMAIL_REGEX_BACKEND = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
