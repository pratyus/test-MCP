const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { UnauthorizedError, BadRequestError } = require('../utils/errors');

const MCP_JWT_SECRET = process.env.MCP_JWT_SECRET || 'default-mcp-secret-key-for-dev';

// Mock user data (in a real app, this would come from a database)
const mockUsers = {
  "contractor1": { 
    userId: "contractor1-id", 
    username: "contractor1", 
    password: "password123", // For mock validation only
    roles: ["contractor"],
    sailpointIdentityId: "sailpoint-id-contractor1" // Example, maps to an ID in SailPoint
  },
  "manager1": { 
    userId: "manager1-id", 
    username: "manager1", 
    password: "password456",
    roles: ["manager", "approver"],
    sailpointIdentityId: "sailpoint-id-manager1"
  },
  "admin1": {
    userId: "admin1-id",
    username: "admin1",
    password: "adminpassword",
    roles: ["admin", "approver"],
    sailpointIdentityId: "sailpoint-id-admin1"
  }
};

/**
 * POST /mcp/api/v1/auth/login
 * Authenticates a user and returns a JWT.
 */

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Authenticate user and obtain JWT
 *     description: Authenticates a user based on username/password or a direct userId (for simulation) and returns a JWT token if successful.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       '200':
 *         description: Authentication successful, JWT token returned.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         description: Authentication failed due to invalid credentials or user not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse' # More specific than generic Unauthorized for this case
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 *     security: [] # Explicitly state that this endpoint does not require authentication
 */
router.post('/login', (req, res, next) => {
  try {
    const { username, password, userId } = req.body;
    logger.info('Login attempt', { service: 'AuthRoute', username, userIdProvided: !!userId });

    let userToSign = null;

    if (userId) {
      // Allow login by userId directly for testing/simulation convenience
      userToSign = Object.values(mockUsers).find(u => u.userId === userId);
      if (!userToSign) {
          // If no direct match, try finding by username if userId was actually a username
           userToSign = mockUsers[userId]; // Assuming userId might be used as username
      }
    } else if (username && password) {
      const foundUser = mockUsers[username];
      if (foundUser && foundUser.password === password) { // Simple password check for mock
        userToSign = foundUser;
      }
    } else {
      throw new BadRequestError('Please provide username and password, or userId.');
    }

    if (!userToSign) {
      logger.warn('Login failed: Invalid credentials or user not found', { service: 'AuthRoute', username });
      throw new UnauthorizedError('Invalid credentials or user not found.'); // This will be caught and handled
    }

    logger.info(`User ${userToSign.username} authenticated successfully. Generating token.`, { service: 'AuthRoute', username: userToSign.username });
    // Prepare JWT payload
  const payload = {
    userId: userToSign.userId,
    username: userToSign.username,
    roles: userToSign.roles,
    sailpointIdentityId: userToSign.sailpointIdentityId // Important for linking MCP user to SailPoint identity
    // Add any other relevant, non-sensitive user information
  };

  // Sign the token
  // For a real app, consider expiresIn carefully.
    jwt.sign(payload, MCP_JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
      if (err) {
        logger.error('Error signing JWT', { service: 'AuthRoute', error: err.message });
        // Do not pass err directly to next if it contains sensitive crypto details
        return next(new Error('Internal server error: Could not generate token.')); 
      }
      res.json({ accessToken: token });
    });
  } catch (error) {
    // Errors thrown (like BadRequestError, UnauthorizedError) will be caught here
    logger.warn(`Login process error: ${error.message}`, { service: 'AuthRoute', errorName: error.name, statusCode: error.statusCode });
    next(error); // Pass to centralized error handler
  }
});

module.exports = router;
