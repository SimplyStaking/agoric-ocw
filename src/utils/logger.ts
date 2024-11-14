import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
  level: 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    // format.colorize(), // Colorizes log output based on log level
    format.printf(({ level, message, timestamp }) => {
      return `[${level.toUpperCase()}] ${timestamp}: ${message}`
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'error.log', level: 'error' }), // Logs only errors to a file
    new transports.File({ filename: 'combined.log' }), // Logs all levels to a combined file
  ],
});
