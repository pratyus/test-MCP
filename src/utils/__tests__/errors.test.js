const {
  ApiError,
  NotFoundError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
} = require('../errors');

describe('Custom Error Classes', () => {
  describe('ApiError', () => {
    it('should create an instance with default values', () => {
      const error = new ApiError(500, 'Test API Error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Test API Error');
      expect(error.isOperational).toBe(true);
      expect(error.stack).toBeDefined();
    });

    it('should create an instance with provided stack', () => {
      const error = new ApiError(400, 'Test with stack', true, 'custom stack');
      expect(error.stack).toBe('custom stack');
    });

    it('should set isOperational correctly', () => {
      const error = new ApiError(500, 'Non-operational', false);
      expect(error.isOperational).toBe(false);
    });
  });

  describe('NotFoundError', () => {
    it('should create a NotFoundError with default message and 404 status', () => {
      const error = new NotFoundError();
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
    });

    it('should create a NotFoundError with custom message', () => {
      const error = new NotFoundError('Custom not found message');
      expect(error.message).toBe('Custom not found message');
    });
  });

  describe('BadRequestError', () => {
    it('should create a BadRequestError with default message and 400 status', () => {
      const error = new BadRequestError();
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad request');
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError with default message, 422 status, and empty errors array', () => {
      const error = new ValidationError();
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(422);
      expect(error.message).toBe('Validation failed');
      expect(error.errors).toEqual([]);
    });

    it('should create a ValidationError with custom message and specific field errors', () => {
      const fieldErrors = [{ field: 'email', message: 'Invalid email format' }];
      const error = new ValidationError('Custom validation message', fieldErrors);
      expect(error.message).toBe('Custom validation message');
      expect(error.errors).toEqual(fieldErrors);
    });
  });

  describe('UnauthorizedError', () => {
    it('should create an UnauthorizedError with default message and 401 status', () => {
      const error = new UnauthorizedError();
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
    });
  });

  describe('ForbiddenError', () => {
    it('should create a ForbiddenError with default message and 403 status', () => {
      const error = new ForbiddenError();
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Forbidden');
    });
  });
});
