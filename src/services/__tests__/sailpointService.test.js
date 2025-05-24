const {
  getAccessToken,
  sailPointGet,
  sailPointPost,
  simulateCreateAccount,
  simulateGetTaskStatus,
  simulateSearchIdentity,
  simulateListAccountsByIdentity,
  simulateDisableAccount,
  simulateSetLifecycleState,
  simulateGetUserDetails,
  simulateGetUserEntitlements,
} = require('../sailpointService'); // Adjust path as necessary

// Mock the logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('SailPoint Service (Mocked)', () => {
  beforeEach(() => {
    // Reset any in-memory state if necessary, though these mocks are fairly stateless or manage their own state.
    // For example, if accessToken was not reset, it could be done here.
    // However, the current getAccessToken mock handles its own simple state.
  });

  describe('getAccessToken', () => {
    it('should return a simulated JWT token', async () => {
      const token1 = await getAccessToken();
      expect(token1).toMatch(/simulated-jwt-token-\d+/);
      // Call again to ensure it might return the same or a new one based on its logic (current returns same if not "expired")
      const token2 = await getAccessToken();
      expect(token2).toEqual(token1); 
    });
  });

  describe('sailPointGet', () => {
    it('should return mocked status for /v3/access-request-status', async () => {
      const params = { filters: 'id eq "testActivityId"' };
      const response = await sailPointGet('/v3/access-request-status', params);
      expect(response.data.id).toBe('testActivityId');
      expect(response.data.status).toBe('COMPLETED');
    });

    it('should return mocked pending approvals for /v3/access-request-approvals/pending', async () => {
      const response = await sailPointGet('/v3/access-request-approvals/pending');
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThanOrEqual(0); // Mock returns one item
      if (response.data.length > 0) {
        expect(response.data[0].id).toBeDefined();
      }
    });

    it('should return default empty data for unhandled GET endpoints', async () => {
      const response = await sailPointGet('/v3/unhandled-get-endpoint');
      expect(response.data).toEqual({});
    });
  });

  describe('sailPointPost', () => {
    it('should return a task ID for /v3/access-requests', async () => {
      const body = { requestedFor: ['id1'], requestedItems: [{id: 'item1'}] };
      const response = await sailPointPost('/v3/access-requests', body);
      expect(response.status).toBe(202);
      expect(response.data.id).toMatch(/task-sim-\d+/);
      expect(response.data.status).toBe('PENDING');
    });

    it('should return success for /approve endpoint', async () => {
      const response = await sailPointPost('/v3/some-approval/approve', { comment: 'ok' });
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('approved');
    });

    it('should return success for /reject endpoint', async () => {
      const response = await sailPointPost('/v3/some-approval/reject', { comment: 'not ok' });
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('rejected');
    });

    it('should return 404 for unhandled POST endpoints', async () => {
      const response = await sailPointPost('/v3/unhandled-post-endpoint', {});
      expect(response.status).toBe(404);
      expect(response.data.error).toBe('Endpoint not found (simulated)');
    });
  });

  describe('simulateCreateAccount', () => {
    it('should return a task ID and simulate account/identity creation', async () => {
      const accountData = {
        sourceId: 'source123',
        attributes: { displayName: 'Test User', mail: 'test@example.com', sAMAccountName: 'testuser' },
      };
      const response = await simulateCreateAccount(accountData);
      expect(response.status).toBe(202);
      expect(response.data.id).toMatch(/account-creation-task-\d+/);
      expect(response.data.status).toBe('QUEUED');

      // Check internal state (not ideal for pure unit tests, but this is testing the mock's behavior)
      const taskDetails = await simulateGetTaskStatus(response.data.id); // QUEUED -> PROCESSING
      const taskDetailsCompleted = await simulateGetTaskStatus(response.data.id); // PROCESSING -> COMPLETED
      const createdAccountId = taskDetailsCompleted.data.result.accountId;
      expect(createdAccountId).toMatch(/simulated-accountId-\d+/);
      
      const identityResponse = await simulateSearchIdentity({ accountId: createdAccountId });
      expect(identityResponse.data.length).toBe(1);
      expect(identityResponse.data[0].name).toBe('Test User');
    });
  });
  
  describe('simulateGetTaskStatus', () => {
    it('should progress task status from QUEUED to PROCESSING to COMPLETED', async () => {
      const accountData = { sourceId: 's1', attributes: { displayName: 'Task User', mail: 'task@example.com' } };
      const creationResponse = await simulateCreateAccount(accountData);
      const taskId = creationResponse.data.id;

      let statusResponse = await simulateGetTaskStatus(taskId);
      expect(statusResponse.data.status).toBe('PROCESSING');

      statusResponse = await simulateGetTaskStatus(taskId);
      expect(statusResponse.data.status).toBe('COMPLETED');
      expect(statusResponse.data.result).toBeDefined();
      expect(statusResponse.data.result.status).toBe('success');

      statusResponse = await simulateGetTaskStatus(taskId); // Should remain COMPLETED
      expect(statusResponse.data.status).toBe('COMPLETED');
    });

    it('should return 404 for an unknown task ID', async () => {
      const response = await simulateGetTaskStatus('unknown-task-id');
      expect(response.status).toBe(404);
    });
  });

  describe('simulateSearchIdentity', () => {
    // Pre-populate an identity for searching
    let testIdentityId;
    let testAccountId;
    const testEmail = 'searchable@example.com';

    beforeAll(async () => {
      const accountData = {
        sourceId: 'searchSource',
        attributes: { displayName: 'Searchable User', mail: testEmail, sAMAccountName: 'searchme' },
      };
      const creationResponse = await simulateCreateAccount(accountData);
      const taskDetails = await simulateGetTaskStatus(creationResponse.data.id); // QUEUED -> PROCESSING
      const taskDetailsCompleted = await simulateGetTaskStatus(creationResponse.data.id); // PROCESSING -> COMPLETED
      testAccountId = taskDetailsCompleted.data.result.accountId;
      testIdentityId = taskDetailsCompleted.data.result.identityId;
    });

    it('should find an identity by email', async () => {
      const response = await simulateSearchIdentity({ email: testEmail });
      expect(response.status).toBe(200);
      expect(response.data.length).toBe(1);
      expect(response.data[0].attributes.mail).toBe(testEmail);
      expect(response.data[0].id).toBe(testIdentityId);
    });

    it('should find an identity by its ID', async () => {
      const response = await simulateSearchIdentity({ identityId: testIdentityId });
      expect(response.status).toBe(200);
      expect(response.data.length).toBe(1);
      expect(response.data[0].id).toBe(testIdentityId);
    });
    
    it('should return 404 if identity not found by email', async () => {
      const response = await simulateSearchIdentity({ email: 'notfound@example.com' });
      expect(response.status).toBe(404);
      expect(response.data).toEqual([]);
    });
  });

  describe('simulateListAccountsByIdentity', () => {
    it('should list accounts for a known identity (user1IdentityId from mock data)', async () => {
      // Find user1IdentityId from the predefined mock data section
      const user1 = Object.values(require('../sailpointService').__get__('simulatedIdentitiesStore')).find(u => u.email === "john.doe.user@example.com");
      const response = await simulateListAccountsByIdentity(user1.id);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toBeGreaterThan(0); // user1 has accounts
      expect(response.data[0].sourceName).toBeDefined();
    });

    it('should return an empty list for an identity with no accounts or unknown identity', async () => {
      const response = await simulateListAccountsByIdentity('unknown-identity-id');
      expect(response.status).toBe(200); // Service returns 200 with empty array
      expect(response.data).toEqual([]);
    });
  });

  describe('simulateDisableAccount', () => {
    it('should disable an account and return a task ID', async () => {
      const user1 = Object.values(require('../sailpointService').__get__('simulatedIdentitiesStore')).find(u => u.email === "john.doe.user@example.com");
      const accountToDisable = user1.accounts[0];
      
      const response = await simulateDisableAccount(accountToDisable.id);
      expect(response.status).toBe(202);
      expect(response.data.id).toMatch(/disable-account-task-\d+/);

      // Verify account is marked as disabled in the mock store
      const identityAccounts = await simulateListAccountsByIdentity(user1.id);
      const disabledAccount = identityAccounts.data.find(acc => acc.id === accountToDisable.id);
      expect(disabledAccount.status).toBe('disabled');
    });
  });

  describe('simulateSetLifecycleState', () => {
     const user1 = Object.values(require('../sailpointService').__get__('simulatedIdentitiesStore')).find(u => u.email === "john.doe.user@example.com");
    
    it('should change lifecycle state and return a task ID', async () => {
      const response = await simulateSetLifecycleState(user1.id, 'terminated');
      expect(response.status).toBe(202);
      expect(response.data.id).toMatch(/set-lcs-task-\d+/);
      
      const identityDetails = await simulateGetUserDetails(user1.id);
      expect(identityDetails.data.lifecycleState).toBe('terminated');
    });

    it('should also disable accounts if lifecycle state is "terminated"', async () => {
      await simulateSetLifecycleState(user1.id, 'active'); // Reset state first
      await simulateSetLifecycleState(user1.id, 'terminated');
      
      const identityAccounts = await simulateListAccountsByIdentity(user1.id);
      identityAccounts.data.forEach(acc => {
        expect(acc.status).toBe('disabled');
      });
    });
  });

  describe('simulateGetUserDetails', () => {
    const user1 = Object.values(require('../sailpointService').__get__('simulatedIdentitiesStore')).find(u => u.email === "john.doe.user@example.com");

    it('should get user details for a known identity', async () => {
      const response = await simulateGetUserDetails(user1.id);
      expect(response.status).toBe(200);
      expect(response.data.id).toBe(user1.id);
      expect(response.data.name).toBe(user1.name);
      expect(response.data.accounts).toBeDefined();
      expect(response.data.manager).toBeDefined();
    });

    it('should return 404 for an unknown identity', async () => {
      const response = await simulateGetUserDetails('unknown-id');
      expect(response.status).toBe(404);
    });
  });

  describe('simulateGetUserEntitlements', () => {
    const user1 = Object.values(require('../sailpointService').__get__('simulatedIdentitiesStore')).find(u => u.email === "john.doe.user@example.com");
    
    it('should get entitlements for a known identity', async () => {
      const response = await simulateGetUserEntitlements(user1.id);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data.length).toEqual(user1.access.length); // Matches predefined access
      if (user1.access.length > 0) {
        expect(response.data[0].id).toBe(user1.access[0].id);
      }
    });

    it('should return 404 for an unknown identity', async () => {
      const response = await simulateGetUserEntitlements('unknown-id');
      expect(response.status).toBe(404);
    });
  });
});

// Helper to access internal mock store variables for some tests
// This is generally not good practice for true unit tests but useful for testing the mock's state.
// Usage: const value = require('../sailpointService').__get__('variableName');
module.exports.__get__ = (name) => {
    if (name === 'simulatedIdentitiesStore') return simulatedIdentitiesStore;
    // Add other variables if needed for testing
    return undefined;
};
