const authenticateToken = require('../authMiddleware');
const jwt = require('jsonwebtoken');
const { UnauthorizedError, ForbiddenError } = require('../../utils/errors');

// Mock the logger to prevent console output during tests and spy on it
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken');

describe('Auth Middleware - authenticateToken', () => {
  let mockRequest;
  let mockResponse;
  let mockNext;

  const mockJwtSecret = process.env.MCP_JWT_SECRET || 'test-super-secret-jwt-key-for-jest';

  beforeEach(() => {
    mockRequest = {
      headers: {},
      path: '/test/path' // For logging context
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    // Reset mocks before each test
    jwt.verify.mockReset();
  });

  it('should call next() with UnauthorizedError if no token is provided', () => {
    authenticateToken(mockRequest, mockResponse, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(mockNext.mock.calls[0][0].message).toBe('Unauthorized: No token provided.');
    expect(mockNext.mock.calls[0][0].statusCode).toBe(401);
  });

  it('should call next() with UnauthorizedError if token is provided without "Bearer " prefix', () => {
    mockRequest.headers['authorization'] = 'sometoken123';
    authenticateToken(mockRequest, mockResponse, mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
     expect(mockNext.mock.calls[0][0].message).toBe('Unauthorized: No token provided.'); // Because split fails
  });
  
  it('should call next() with UnauthorizedError if token is expired', () => {
    mockRequest.headers['authorization'] = 'Bearer expiredtoken123';
    jwt.verify.mockImplementation((token, secret, callback) => {
      const error = new Error('TokenExpiredError');
      error.name = 'TokenExpiredError';
      callback(error);
    });

    authenticateToken(mockRequest, mockResponse, mockNext);

    expect(jwt.verify).toHaveBeenCalledWith('expiredtoken123', mockJwtSecret, expect.any(Function));
    expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(mockNext.mock.calls[0][0].message).toBe('Unauthorized: Token expired.');
    expect(mockNext.mock.calls[0][0].statusCode).toBe(401);
  });

  it('should call next() with ForbiddenError if token verification fails for other reasons', () => {
    mockRequest.headers['authorization'] = 'Bearer invalidtoken123';
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(new Error('some other verification error'));
    });

    authenticateToken(mockRequest, mockResponse, mockNext);

    expect(jwt.verify).toHaveBeenCalledWith('invalidtoken123', mockJwtSecret, expect.any(Function));
    expect(mockNext).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect(mockNext.mock.calls[0][0].message).toBe('Forbidden: Invalid token.');
    expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
  });

  it('should call next() and attach user to req if token is valid', () => {
    const mockUserPayload = { userId: '123', username: 'testuser', roles: ['user'] };
    mockRequest.headers['authorization'] = 'Bearer validtoken123';
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, mockUserPayload);
    });

    authenticateToken(mockRequest, mockResponse, mockNext);

    expect(jwt.verify).toHaveBeenCalledWith('validtoken123', mockJwtSecret, expect.any(Function));
    expect(mockRequest.user).toEqual(mockUserPayload);
    expect(mockNext).toHaveBeenCalledWith(); // Called with no arguments
    expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error)); // Ensure no error passed to next
  });
});
