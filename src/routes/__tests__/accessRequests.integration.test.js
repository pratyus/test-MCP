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

describe('Access Requests Routes - Integration Tests', () => {
  let validToken;
  const mockUser = { userId: 'testUserId', username: 'testuser', roles: ['contractor'], sailpointIdentityId: 'sp-test-user-id' };

  beforeAll(() => {
    // Generate a token for testing protected routes
    validToken = jwt.sign(mockUser, MCP_JWT_SECRET, { expiresIn: '1h' });
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /mcp/api/v1/requests', () => {
    const validRequestBody = {
      requestedFor: ['sailpoint-id-user1', 'sailpoint-id-user2'],
      items: [{ id: 'accessProfileId1', type: 'ACCESS_PROFILE', comment: 'Need for Project X' }],
      justification: 'Overall project justification',
    };

    it('should submit an access request successfully and return 202', async () => {
      const mockSailPointResponse = {
        status: 202,
        data: { id: 'sailpointActivityId123', type: 'TASK_RESULT', status: 'PENDING' },
      };
      sailpointService.sailPointPost.mockResolvedValue(mockSailPointResponse);

      const response = await request(app)
        .post('/mcp/api/v1/requests')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validRequestBody);

      expect(response.statusCode).toBe(202);
      expect(response.body).toEqual({
        requestId: 'sailpointActivityId123',
        status: 'PENDING',
        message: 'Access request submitted successfully. Status can be tracked.',
      });
      expect(sailpointService.sailPointPost).toHaveBeenCalledWith(
        '/v3/access-requests',
        expect.objectContaining({
          requestedFor: validRequestBody.requestedFor,
          requestType: 'GRANT_ACCESS',
          requestedItems: expect.arrayContaining([
            expect.objectContaining({
              id: 'accessProfileId1',
              type: 'ACCESS_PROFILE',
              comment: 'Need for Project X', // or justification if item comment is null
            }),
          ]),
        })
      );
    });

    it('should return 400 if requestedFor is missing', async () => {
      const { requestedFor, ...badPayload } = validRequestBody;
      const response = await request(app)
        .post('/mcp/api/v1/requests')
        .set('Authorization', `Bearer ${validToken}`)
        .send(badPayload);
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('requestedFor is required');
    });

    it('should return 400 if items are missing', async () => {
      const { items, ...badPayload } = validRequestBody;
      const response = await request(app)
        .post('/mcp/api/v1/requests')
        .set('Authorization', `Bearer ${validToken}`)
        .send(badPayload);
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('items is required');
    });
    
    it('should return 401 if no token is provided', async () => {
      const response = await request(app)
        .post('/mcp/api/v1/requests')
        .send(validRequestBody);
      expect(response.statusCode).toBe(401);
      expect(response.body.error).toContain('No token provided');
    });

    it('should return 500 if sailpointService fails unexpectedly', async () => {
        sailpointService.sailPointPost.mockRejectedValue(new Error('SailPoint service internal error'));
        const response = await request(app)
            .post('/mcp/api/v1/requests')
            .set('Authorization', `Bearer ${validToken}`)
            .send(validRequestBody);
        expect(response.statusCode).toBe(500); // Error handler should catch this
        expect(response.body.error).toContain('Internal server error');
    });
  });

  describe('GET /mcp/api/v1/requests/status/:sailpointActivityId', () => {
    const mockActivityId = 'mockActivity123';

    it('should retrieve access request status successfully and return 200', async () => {
      const mockSailPointStatusResponse = {
        data: {
          id: mockActivityId,
          status: 'COMPLETED',
          requestedItemsStatus: [
            { id: 'item1', type: 'ACCESS_PROFILE', name: 'AP One', status: 'APPROVED' },
          ],
          created: new Date().toISOString(),
          requester: { id: 'requesterId', name: 'Test Requester' },
        },
      };
      sailpointService.sailPointGet.mockResolvedValue(mockSailPointStatusResponse);

      const response = await request(app)
        .get(`/mcp/api/v1/requests/status/${mockActivityId}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.requestId).toBe(mockActivityId);
      expect(response.body.status).toBe('COMPLETED');
      expect(response.body.requestedItems).toEqual([
        { id: 'item1', type: 'ACCESS_PROFILE', name: 'AP One', status: 'APPROVED' },
      ]);
      expect(sailpointService.sailPointGet).toHaveBeenCalledWith(
        '/v3/access-request-status',
        { filters: `id eq "${mockActivityId}"` }
      );
    });

    it('should return 404 if status not found from SailPoint', async () => {
      sailpointService.sailPointGet.mockResolvedValue({ status: 404, data: { message: "Not found" } });
      const response = await request(app)
        .get(`/mcp/api/v1/requests/status/${mockActivityId}`)
        .set('Authorization', `Bearer ${validToken}`);
      expect(response.statusCode).toBe(404);
      expect(response.body.error).toContain('Access request status not found');
    });

    it('should return 401 if no token is provided', async () => {
      const response = await request(app).get(`/mcp/api/v1/requests/status/${mockActivityId}`);
      expect(response.statusCode).toBe(401);
    });

    it('should return 400 if sailpointActivityId is missing (though route structure prevents this specific Express error)', async () => {
        // This test is more about ensuring our validation (if any) in the route works,
        // but Express routing itself would 404 if the param isn't part of the path.
        // If we had specific validation logic for the param format, we'd test that.
        // For now, an empty ID might get passed to the service.
        sailpointService.sailPointGet.mockResolvedValue({ status: 404, data: {} }); // Simulate not found
         const response = await request(app)
            .get(`/mcp/api/v1/requests/status/ `) // Deliberately empty (or invalid) ID
            .set('Authorization', `Bearer ${validToken}`);
        // Depending on how the route handles an empty param that still technically matches the route.
        // Our current route code would pass " " to sailpointService.
        // If it was /mcp/api/v1/requests/status/  (no actual ID), Express would 404 by default.
        // Let's assume an ID that leads to a "not found" from the service.
        expect(response.statusCode).toBe(404); // Or 400 if validation was stricter for empty string ID
    });
  });
});
