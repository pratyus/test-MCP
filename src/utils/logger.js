const winston = require('winston');

const { combine, timestamp, printf, colorize, align, json } = winston.format;

// Determine log level from environment variable, default to 'info'
const logLevel = process.env.LOG_LEVEL || 'info';

// Custom log format
const customLogFormat = printf(({ level, message, timestamp, service, stack }) => {
  let log = `${timestamp} [${service || 'MCP-Server'}] ${level}: ${message}`;
  if (stack) {
    log = `${log}\nStack: ${stack}`;
  }
  return log;
});

const logger = winston.createLogger({
  level: logLevel,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    // json() // Alternative for structured logging to a file or platform
  ),
  transports: [
    // Console transport - for development, with colorized output
    new winston.transports.Console({
      format: combine(
        colorize(),
        align(),
        customLogFormat
      ),
    }),
    // File transport - for production (example)
    // In a real production environment, you might have more sophisticated file rotation,
    // or send logs to a centralized logging platform.
    // new winston.transports.File({ 
    //   filename: 'logs/error.log', 
    //   level: 'error',
    //   format: combine(json()) // Errors often best in JSON for parsing
    // }),
    // new winston.transports.File({ 
    //   filename: 'logs/combined.log',
    //   format: combine(json())
    // }),
  ],
  exceptionHandlers: [ // Optional: Catch and log unhandled exceptions
    new winston.transports.Console({
        format: combine(
        colorize(),
        align(),
        customLogFormat
      ),
    }),
    // new winston.transports.File({ filename: 'logs/exceptions.log', format: combine(json()) })
  ],
  rejectionHandlers: [ // Optional: Catch and log unhandled promise rejections
     new winston.transports.Console({
        format: combine(
        colorize(),
        align(),
        customLogFormat
      ),
    }),
    // new winston.transports.File({ filename: 'logs/rejections.log', format: combine(json()) })
  ]
});

// If not in production, add a simple file transport for all logs for easier debugging during dev
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/dev-combined.log',
    format: combine(
        align(),
        customLogFormat
    )
  }));
   logger.add(new winston.transports.File({
    filename: 'logs/dev-error.log',
    level: 'error',
    format: combine(
        align(),
        customLogFormat
    )
  }));
}

// Create a stream object with a 'write' function that will be used by morgan (for request logging)
logger.stream = {
  write: (message) => {
    // Morgan adds a newline, remove it to avoid double newlines with winston's format
    logger.info(message.substring(0, message.lastIndexOf('\n')));
  },
};

module.exports = logger;
