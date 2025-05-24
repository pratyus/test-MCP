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

describe('Contractors Routes - Integration Tests', () => {
  let validToken;
  const mockAdminUser = { userId: 'adminUserId', username: 'adminUser', roles: ['admin'], sailpointIdentityId: 'sp-admin-user-id' };

  beforeAll(() => {
    validToken = jwt.sign(mockAdminUser, MCP_JWT_SECRET, { expiresIn: '1h' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /mcp/api/v1/contractors/onboard', () => {
    const validOnboardPayload = {
      firstName: 'New',
      lastName: 'Contractor',
      email: 'new.contractor@example.com',
      managerSailPointId: 'sp-manager-id',
      attributes: { sAMAccountName: 'newbie', department: 'Temp' },
      initialAccess: [{ id: 'ap-initial', type: 'ACCESS_PROFILE' }],
    };

    it('should successfully initiate contractor onboarding and return 202', async () => {
      const mockAccountCreationTaskId = 'task-acc-create-123';
      const mockNewAccountId = 'sim-acc-new-1';
      const mockNewIdentityId = 'sim-id-new-1';
      const mockAccessRequestTaskId = 'task-ar-123';

      sailpointService.simulateCreateAccount.mockResolvedValue({
        status: 202,
        data: { id: mockAccountCreationTaskId, type: 'ACCOUNT_ACTIVITY', status: 'QUEUED' },
      });
      sailpointService.simulateGetTaskStatus
        .mockResolvedValueOnce({ // First call for account creation task
          data: { id: mockAccountCreationTaskId, status: 'QUEUED' } // Simulating initial QUEUED then direct to COMPLETED for simplicity in this test
        })
        .mockResolvedValueOnce({ // Second call (or more in real polling) for account creation task
          data: { 
            id: mockAccountCreationTaskId, 
            status: 'COMPLETED', 
            result: { accountId: mockNewAccountId, identityId: mockNewIdentityId, status: 'success' } 
          }
        });
      sailpointService.simulateSearchIdentity.mockResolvedValue({ // In case identityId isn't in task result
        status: 200,
        data: [{ id: mockNewIdentityId, name: 'New Contractor' }]
      });
      sailpointService.sailPointPost.mockResolvedValue({ // For initial access request
        status: 202,
        data: { id: mockAccessRequestTaskId, type: 'TASK_RESULT', status: 'PENDING' },
      });

      const response = await request(app)
        .post('/mcp/api/v1/contractors/onboard')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validOnboardPayload);

      expect(response.statusCode).toBe(202);
      expect(response.body.status).toBe('PENDING');
      expect(response.body.message).toContain('Contractor onboarding process initiated successfully');
      expect(response.body.sailpointAccountId).toBe(mockNewAccountId);
      expect(response.body.sailpointIdentityId).toBe(mockNewIdentityId);
      
      expect(sailpointService.simulateCreateAccount).toHaveBeenCalledWith(expect.objectContaining({
        attributes: expect.objectContaining({ mail: validOnboardPayload.email })
      }));
      expect(sailpointService.simulateGetTaskStatus).toHaveBeenCalledWith(mockAccountCreationTaskId);
      // simulateSearchIdentity might be called if identityId is not in taskResult, this depends on mock behavior
      expect(sailpointService.sailPointPost).toHaveBeenCalledWith(
        '/v3/access-requests',
        expect.objectContaining({
          requestedFor: [mockNewIdentityId],
          requestedItems: expect.arrayContaining([
            expect.objectContaining({ id: 'ap-initial' })
          ])
        })
      );
    });

    it('should return 400 if required fields are missing', async () => {
      const { email, ...incompletePayload } = validOnboardPayload;
      const response = await request(app)
        .post('/mcp/api/v1/contractors/onboard')
        .set('Authorization', `Bearer ${validToken}`)
        .send(incompletePayload);
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });
    
    it('should return 401 if no token is provided', async () => {
        const response = await request(app)
            .post('/mcp/api/v1/contractors/onboard')
            .send(validOnboardPayload);
        expect(response.statusCode).toBe(401);
    });

    it('should return 500 if account creation task fails to complete', async () => {
        sailpointService.simulateCreateAccount.mockResolvedValue({
            status: 202, data: { id: 'task-fail-complete', type: 'ACCOUNT_ACTIVITY', status: 'QUEUED' },
        });
        sailpointService.simulateGetTaskStatus.mockResolvedValue({ // Always returns non-completed status
            data: { id: 'task-fail-complete', status: 'PROCESSING' }
        });

        const response = await request(app)
            .post('/mcp/api/v1/contractors/onboard')
            .set('Authorization', `Bearer ${validToken}`)
            .send(validOnboardPayload);
        
        expect(response.statusCode).toBe(500);
        expect(response.body.error).toContain('Task task-fail-complete did not complete');
    });
  });

  describe('POST /mcp/api/v1/contractors/offboard', () => {
    const validOffboardPayload = {
      contractorSailPointIdentityId: 'sp-contractor-to-offboard',
      justification: 'Contract ended.',
      revokeAllAccess: true,
    };

    it('should successfully initiate contractor offboarding and return 202', async () => {
      const mockLcsTaskId = 'task-lcs-offboard-123';
      sailpointService.simulateSetLifecycleState.mockResolvedValue({
        status: 202,
        data: { id: mockLcsTaskId, type: 'IDENTITY_LIFECYCLE_UPDATE', status: 'QUEUED' },
      });
      sailpointService.simulateGetTaskStatus.mockResolvedValue({ // For LCS task
        data: { id: mockLcsTaskId, status: 'COMPLETED', result: { status: 'success' } },
      });

      const response = await request(app)
        .post('/mcp/api/v1/contractors/offboard')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validOffboardPayload);

      expect(response.statusCode).toBe(202);
      expect(response.body.status).toBe('PENDING');
      expect(response.body.message).toContain('Contractor offboarding process initiated successfully');
      expect(response.body.sailpointTaskActivityId).toBe(mockLcsTaskId);
      
      expect(sailpointService.simulateSetLifecycleState).toHaveBeenCalledWith(
        validOffboardPayload.contractorSailPointIdentityId,
        process.env.SAILPOINT_TERMINATED_LCS || 'terminated'
      );
      expect(sailpointService.simulateGetTaskStatus).toHaveBeenCalledWith(mockLcsTaskId);
    });

    it('should return 400 if contractorSailPointIdentityId is missing', async () => {
      const { contractorSailPointIdentityId, ...incompletePayload } = validOffboardPayload;
      const response = await request(app)
        .post('/mcp/api/v1/contractors/offboard')
        .set('Authorization', `Bearer ${validToken}`)
        .send(incompletePayload);
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toContain('contractorSailPointIdentityId is required');
    });

    it('should return 401 if no token is provided', async () => {
        const response = await request(app)
            .post('/mcp/api/v1/contractors/offboard')
            .send(validOffboardPayload);
        expect(response.statusCode).toBe(401);
    });
  });
});
