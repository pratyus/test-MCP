const request = require('supertest');
const app = require('../../index'); // Adjust path to your Express app
const jwt = require('jsonwebtoken');
const sailpointService = require('../../services/sailpointService');

const MCP_JWT_SECRET = process.env.MCP_JWT_SECRET || 'test-super-secret-jwt-key-for-jest';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  stream: { write: jest.fn() },
}));

// Mock the entire sailpointService
jest.mock('../../services/sailpointService');

describe('User Info Routes - Integration Tests', () => {
  let validToken;
  const mockUser = { userId: 'testUserId', username: 'testuser', roles: ['user'], sailpointIdentityId: 'sp-test-user-id' };
  const targetSailpointIdentityId = 'sp-targetUser-id-123';

  beforeAll(() => {
    validToken = jwt.sign(mockUser, MCP_JWT_SECRET, { expiresIn: '1h' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /mcp/api/v1/users/:sailpointIdentityId', () => {
    it('should retrieve user details successfully and return 200', async () => {
      const mockUserDetailsResponse = {
        status: 200,
        data: {
          id: targetSailpointIdentityId,
          name: 'Target User',
          attributes: { mail: 'target@example.com', department: 'Sales' },
          lifecycleState: 'active',
          manager: { id: 'sp-manager-id', name: 'Manager Name' },
          accounts: [{ id: 'acc1', sourceName: 'AD', nativeIdentity: 'targetUserAD' }],
        },
      };
      sailpointService.simulateGetUserDetails.mockResolvedValue(mockUserDetailsResponse);

      const response = await request(app)
        .get(`/mcp/api/v1/users/${targetSailpointIdentityId}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.id).toBe(targetSailpointIdentityId);
      expect(response.body.displayName).toBe('Target User');
      expect(response.body.email).toBe('target@example.com');
      expect(response.body.manager.displayName).toBe('Manager Name');
      expect(response.body.accounts[0].nativeIdentity).toBe('targetUserAD');
      expect(sailpointService.simulateGetUserDetails).toHaveBeenCalledWith(targetSailpointIdentityId);
    });

    it('should return 404 if user details are not found', async () => {
      sailpointService.simulateGetUserDetails.mockResolvedValue({
        status: 404,
        data: { message: 'User not found' },
      });
      const response = await request(app)
        .get(`/mcp/api/v1/users/unknownUserId`)
        .set('Authorization', `Bearer ${validToken}`);
      expect(response.statusCode).toBe(404);
      expect(response.body.error).toContain('User details not found');
    });
    
    it('should return 401 if no token is provided', async () => {
        const response = await request(app).get(`/mcp/api/v1/users/${targetSailpointIdentityId}`);
        expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /mcp/api/v1/users/:sailpointIdentityId/entitlements', () => {
    it('should retrieve user entitlements successfully and return 200', async () => {
      const mockUserEntitlementsResponse = {
        status: 200,
        data: [
          { id: 'ap1', type: 'ACCESS_PROFILE', name: 'AP One', description: 'Desc One' },
          { id: 'role1', type: 'ROLE', name: 'Role One', description: 'Role Desc One', source: 'SourceX' },
        ],
      };
      sailpointService.simulateGetUserEntitlements.mockResolvedValue(mockUserEntitlementsResponse);

      const response = await request(app)
        .get(`/mcp/api/v1/users/${targetSailpointIdentityId}/entitlements`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0].name).toBe('AP One');
      expect(response.body[1].source).toBe('SourceX');
      expect(sailpointService.simulateGetUserEntitlements).toHaveBeenCalledWith(targetSailpointIdentityId);
    });

    it('should return 200 with an empty array if user has no entitlements', async () => {
        sailpointService.simulateGetUserEntitlements.mockResolvedValue({
            status: 200,
            data: [],
        });
        const response = await request(app)
            .get(`/mcp/api/v1/users/${targetSailpointIdentityId}/entitlements`)
            .set('Authorization', `Bearer ${validToken}`);
        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual([]);
    });
    
    it('should return 404 if user not found when fetching entitlements', async () => {
      sailpointService.simulateGetUserEntitlements.mockResolvedValue({
        status: 404, // Or the service might return a specific error structure our route interprets
        data: { message: 'User not found for entitlements query' } 
      });
      const response = await request(app)
        .get(`/mcp/api/v1/users/unknownUserId/entitlements`)
        .set('Authorization', `Bearer ${validToken}`);
      expect(response.statusCode).toBe(404); // As the route throws NotFoundError
      expect(response.body.error).toContain('User not found with ID unknownUserId when fetching entitlements.');
    });

    it('should return 401 if no token is provided', async () => {
        const response = await request(app).get(`/mcp/api/v1/users/${targetSailpointIdentityId}/entitlements`);
        expect(response.statusCode).toBe(401);
    });
  });
});
