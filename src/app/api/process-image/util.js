import logger from '@/app/api/process-image/logger.js';

export async function countdown(label, durationMs) {
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
      logger.info(text);
    }
  };
  logger.info(`🧙 ${label}（剩余 ${formatTime(remaining)}）`);
  return new Promise((resolve) => {
    const timer = setInterval(() => {
      remaining -= interval;
      if (process.stdout.isTTY) {
        writeOutput(`⏳ ${label}（剩余 ${formatTime(remaining)}）`);
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
