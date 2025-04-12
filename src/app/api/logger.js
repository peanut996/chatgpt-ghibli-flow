import pino from 'pino';

const transport = pino.transport({
  target: 'pino-pretty',
  options: {
    colorize: true,
    levelFirst: true,
    translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
    ignore: 'pid,hostname',
    levelLabels: {
      10: '跟踪',
      20: '调试',
      30: '信息',
      40: '警告',
      50: '错误',
      60: '致命',
    },
  },
});

const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
  },
  transport,
);

export default logger;
