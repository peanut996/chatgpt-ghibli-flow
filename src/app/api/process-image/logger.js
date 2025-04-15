import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const readableFormat = printf(({ level, message, timestamp, stack }) => {
  let log = `${timestamp} ${level}: ${message}`;
  if (stack) {
    log += `\n${stack}`;
  }
  return log;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    colorize(), // Add colors (optional, might need TERM set in prod)
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), // Add timestamp
    errors({ stack: true }), // Automatically handle error stacks
    readableFormat, // Apply the custom readable format
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
