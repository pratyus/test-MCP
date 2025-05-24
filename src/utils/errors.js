/**
 * @description Base class for custom API errors.
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {boolean} isOperational - True if the error is operational (expected), false otherwise
 * @param {string} [stack=''] - Error stack trace
 */
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class NotFoundError extends ApiError {
  constructor(message = 'Resource not found', stack = '') {
    super(404, message, true, stack);
  }
}

class BadRequestError extends ApiError {
  constructor(message = 'Bad request', stack = '') {
    super(400, message, true, stack);
  }
}

class ValidationError extends ApiError {
  constructor(message = 'Validation failed', errors = [], stack = '') {
    super(422, message, true, stack); // 422 Unprocessable Entity
    this.errors = errors; // To hold specific field validation errors
  }
}

class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', stack = '') {
    super(401, message, true, stack);
  }
}

class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', stack = '') {
    super(403, message, true, stack);
  }
}

module.exports = {
  ApiError,
  NotFoundError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
};
