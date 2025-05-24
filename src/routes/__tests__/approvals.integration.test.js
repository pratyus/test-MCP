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

describe('Approvals Routes - Integration Tests', () => {
  let validToken;
  const mockUser = { userId: 'approverUserId', username: 'approverUser', roles: ['approver'], sailpointIdentityId: 'sp-approver-id' };
  const mockApprovalId = 'mockApproval123';

  beforeAll(() => {
    validToken = jwt.sign(mockUser, MCP_JWT_SECRET, { expiresIn: '1h' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /mcp/api/v1/approvals/pending', () => {
    it('should retrieve a list of pending approvals and return 200', async () => {
      const mockSailPointApprovalsResponse = {
        data: [
          {
            id: mockApprovalId,
            name: 'Approval for Access X',
            created: new Date().toISOString(),
            request: {
              requestId: 'req123',
              requester: { id: 'reqUserId', name: 'Requester User' },
              requestedFor: [{ id: 'targetUserId', name: 'Target User' }],
              requestedItems: [{ id: 'item1', type: 'ACCESS_PROFILE', name: 'AP for X' }],
              dateRequested: new Date().toISOString(),
            },
            requesterComment: 'Please approve.',
          },
        ],
      };
      sailpointService.sailPointGet.mockResolvedValue(mockSailPointApprovalsResponse);

      const response = await request(app)
        .get('/mcp/api/v1/approvals/pending')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].approvalId).toBe(mockApprovalId);
      expect(response.body[0].request.requestId).toBe('req123');
      expect(sailpointService.sailPointGet).toHaveBeenCalledWith('/v3/access-request-approvals/pending');
    });

    it('should return 401 if no token is provided', async () => {
      const response = await request(app).get('/mcp/api/v1/approvals/pending');
      expect(response.statusCode).toBe(401);
    });
    
    it('should return 500 if sailpointService fails', async () => {
      sailpointService.sailPointGet.mockRejectedValue(new Error("Service failure"));
      const response = await request(app)
        .get('/mcp/api/v1/approvals/pending')
        .set('Authorization', `Bearer ${validToken}`);
      expect(response.statusCode).toBe(500);
    });
  });

  describe('POST /mcp/api/v1/approvals/:approvalId/approve', () => {
    const validApprovalPayload = { comment: 'Approved for business reasons.' };

    it('should approve a pending request and return 200', async () => {
      sailpointService.sailPointPost.mockResolvedValue({
        status: 200,
        data: { status: 'approved', message: 'Request approved successfully (simulated)' },
      });

      const response = await request(app)
        .post(`/mcp/api/v1/approvals/${mockApprovalId}/approve`)
        .set('Authorization', `Bearer ${validToken}`)
        .send(validApprovalPayload);

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe('SUCCESS');
      expect(response.body.message).toContain('Approval submitted successfully');
      expect(sailpointService.sailPointPost).toHaveBeenCalledWith(
        `/v3/access-request-approvals/${mockApprovalId}/approve`,
        validApprovalPayload
      );
    });

    it('should return 400 if comment is missing', async () => {
      const response = await request(app)
        .post(`/mcp/api/v1/approvals/${mockApprovalId}/approve`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({}); // Missing comment
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('Comment is required for approval');
    });
    
    it('should return 401 if no token is provided', async () => {
      const response = await request(app)
        .post(`/mcp/api/v1/approvals/${mockApprovalId}/approve`)
        .send(validApprovalPayload);
      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /mcp/api/v1/approvals/:approvalId/reject', () => {
    const validRejectionPayload = { comment: 'Rejected due to policy violation.' };

    it('should reject a pending request and return 200', async () => {
      sailpointService.sailPointPost.mockResolvedValue({
        status: 200,
        data: { status: 'rejected', message: 'Request rejected successfully (simulated)' },
      });

      const response = await request(app)
        .post(`/mcp/api/v1/approvals/${mockApprovalId}/reject`)
        .set('Authorization', `Bearer ${validToken}`)
        .send(validRejectionPayload);

      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe('SUCCESS');
      expect(response.body.message).toContain('Rejection submitted successfully');
      expect(sailpointService.sailPointPost).toHaveBeenCalledWith(
        `/v3/access-request-approvals/${mockApprovalId}/reject`,
        validRejectionPayload
      );
    });

    it('should return 400 if comment is missing', async () => {
      const response = await request(app)
        .post(`/mcp/api/v1/approvals/${mockApprovalId}/reject`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({}); // Missing comment
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('Comment is required for rejection');
    });
    
    it('should return 401 if no token is provided', async () => {
      const response = await request(app)
        .post(`/mcp/api/v1/approvals/${mockApprovalId}/reject`)
        .send(validRejectionPayload);
      expect(response.statusCode).toBe(401);
    });
  });
});
