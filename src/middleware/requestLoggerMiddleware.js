const logger = require('../utils/logger');

function requestLogger(req, res, next) {
  const start = Date.now();
  
  // Log basic request info at the start
  logger.info(`Incoming Request: ${req.method} ${req.originalUrl} from ${req.ip}`, {
    service: 'RequestLogger',
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    headers: req.headers // Be cautious with logging all headers in production due to sensitive info
  });

  // Log response info when the request is finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`Request Handled: ${req.method} ${req.originalUrl} - Status ${res.statusCode} [${duration}ms]`, {
      service: 'RequestLogger',
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration
    });
  });

  next();
}

module.exports = requestLogger;
