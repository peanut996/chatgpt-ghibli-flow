// src/app/api/process-image/promptConfig.js

/**
 * Enum defining the available prompt types.
 */
export const PromptType = {
  GHIBLI: 'ghibli',
  CAT_HUMAN: 'cat-human',
  IRASUTOYA: 'irasutoya',
  CUSTOM: 'custom',
};

/**
 * Default prompt texts associated with predefined types.
 * These can be overridden by environment variables.
 */
export const defaultPrompts = {
  [PromptType.GHIBLI]:
    process.env.PROMPT_GHIBLI ||
    '请将这张图片转换为吉卜力风格的图像。去除右下角文字，保持原来图像的长宽比',
  [PromptType.CAT_HUMAN]:
    process.env.PROMPT_CAT_HUMAN ||
    '请将这张图片中的猫咪模拟成人类。去除右下角文字，保持原来图像的长宽比',
  [PromptType.IRASUTOYA]:
    process.env.PROMPT_IRASUTOYA ||
    '生成日本小人(类似于irasutoyo)风格，不要右下角文字，保持原来图像的长宽比',
  // CUSTOM and NONE types do not have default prompts defined here.
};
