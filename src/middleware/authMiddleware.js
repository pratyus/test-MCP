const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

const MCP_JWT_SECRET = process.env.MCP_JWT_SECRET || 'default-mcp-secret-key-for-dev';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') && authHeader.split(' ')[1];

  if (token == null) {
    logger.warn('Authentication attempt failed: No token provided.', { service: 'AuthMiddleware', path: req.path });
    return next(new UnauthorizedError('Unauthorized: No token provided.'));
  }

  jwt.verify(token, MCP_JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        logger.warn('Authentication failed: Token expired.', { service: 'AuthMiddleware', path: req.path, errorName: err.name });
        return next(new UnauthorizedError('Unauthorized: Token expired.'));
      }
      logger.error('JWT Verification Error', { service: 'AuthMiddleware', path: req.path, errorName: err.name, errorMessage: err.message });
      return next(new ForbiddenError('Forbidden: Invalid token.'));
    }

    logger.info(`User authenticated successfully: ${user.username} (ID: ${user.userId})`, { 
        service: 'AuthMiddleware', 
        userId: user.userId, 
        username: user.username,
        path: req.path 
    });
    req.user = user; // Add decoded payload to request object

    // Placeholder for more granular authorization:
    // For example, you might check req.user.roles or req.user.permissions here
    // against the required permissions for the route being accessed.
    // e.g., if (!req.user.roles.includes('admin')) {
    //   return res.status(403).json({ error: 'Forbidden: Insufficient permissions.' });
    // }

    next(); // Proceed to the next middleware or route handler
  });
}

module.exports = authenticateToken;
