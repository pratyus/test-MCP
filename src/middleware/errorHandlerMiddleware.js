const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');

/**
 * Centralized error handling middleware.
 * This should be the last middleware added to the Express app.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Default to 500 if statusCode or message is not set (unexpected error)
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected internal server error occurred.';
  let isOperational = err.isOperational !== undefined ? err.isOperational : false;

  // Log the error
  const logMessage = `Status: ${statusCode}, Message: ${message}, Path: ${req.originalUrl}, Method: ${req.method}`;
  if (statusCode >= 500 && !isOperational) { // Programmer errors or critical issues
    logger.error(logMessage, { 
      error: { 
        message: err.message, 
        stack: err.stack, 
        name: err.name 
      }, 
      requestBody: req.body, // Be cautious logging full body in production
      requestQuery: req.query,
      requestParams: req.params
    });
    // For critical/programmer errors, don't send stack trace to client in production
    if (process.env.NODE_ENV === 'production') {
      message = 'Internal Server Error.'; // Generic message
    } else {
        message = err.stack; // Or err.message for a cleaner but less informative error during dev
    }
  } else { // Operational errors or less critical errors
    logger.warn(logMessage, { error: { message: err.message, name: err.name }, isOperational });
  }

  // If headers have already been sent, delegate to the default Express error handler
  if (res.headersSent) {
    return next(err);
  }
  
  const errorResponse = {
    error: message,
  };

  // If it's a ValidationError and has specific field errors
  if (err.name === 'ValidationError' && err.errors) {
    errorResponse.fieldErrors = err.errors;
  }


  res.status(statusCode).json(errorResponse);
}

module.exports = errorHandler;
