const request = require('supertest');
const app = require('../../index'); // Assuming your Express app is exported from src/index.js
const jwt = require('jsonwebtoken');

const MCP_JWT_SECRET = process.env.MCP_JWT_SECRET || 'test-super-secret-jwt-key-for-jest'; // Ensure this is the same as in jest.setup.js

// Mock the logger to keep test output clean
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  stream: { write: jest.fn() },
}));


describe('Auth Routes - Integration Tests', () => {
  describe('POST /mcp/api/v1/auth/login', () => {
    it('should return a JWT token for valid username/password credentials', async () => {
      const credentials = {
        username: 'contractor1',
        password: 'password123',
      };
      const response = await request(app)
        .post('/mcp/api/v1/auth/login')
        .send(credentials);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      
      // Verify the token (optional, but good for sanity check)
      const decoded = jwt.verify(response.body.accessToken, MCP_JWT_SECRET);
      expect(decoded.username).toBe(credentials.username);
      expect(decoded.userId).toBe('contractor1-id');
      expect(decoded.roles).toContain('contractor');
      expect(decoded.sailpointIdentityId).toBeDefined();
    });

    it('should return a JWT token for valid userId', async () => {
      const credentials = {
        userId: 'manager1-id', 
      };
      const response = await request(app)
        .post('/mcp/api/v1/auth/login')
        .send(credentials);

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      const decoded = jwt.verify(response.body.accessToken, MCP_JWT_SECRET);
      expect(decoded.userId).toBe(credentials.userId);
      expect(decoded.username).toBe('manager1');
      expect(decoded.roles).toContain('manager');
    });
    
    it('should return 401 for invalid username/password credentials', async () => {
      const credentials = {
        username: 'contractor1',
        password: 'wrongpassword',
      };
      const response = await request(app)
        .post('/mcp/api/v1/auth/login')
        .send(credentials);

      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials or user not found.');
    });

    it('should return 401 for non-existent username', async () => {
      const credentials = {
        username: 'nouser',
        password: 'password123',
      };
      const response = await request(app)
        .post('/mcp/api/v1/auth/login')
        .send(credentials);

      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials or user not found.');
    });

    it('should return 401 for non-existent userId', async () => {
      const credentials = {
        userId: 'non-existent-user-id',
      };
      const response = await request(app)
        .post('/mcp/api/v1/auth/login')
        .send(credentials);

      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials or user not found.');
    });

    it('should return 400 if no credentials are provided', async () => {
      const response = await request(app)
        .post('/mcp/api/v1/auth/login')
        .send({});

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error', 'Please provide username and password, or userId.');
    });
  });
});
