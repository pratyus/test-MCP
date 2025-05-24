const axios = require('axios'); // Though we'll mock, it's good to have for structure
const logger = require('../utils/logger'); // Import logger

// Simulate environment variables
const SAILPOINT_TENANT_URL = process.env.SAILPOINT_TENANT_URL || 'https://mock-tenant.api.identitynow.com';
const SAILPOINT_CLIENT_ID = process.env.SAILPOINT_CLIENT_ID || 'mockClientId';
const SAILPOINT_CLIENT_SECRET = process.env.SAILPOINT_CLIENT_SECRET || 'mockClientSecret';

let accessToken = null;

/**
 * Simulates obtaining an access token from SailPoint.
 */
async function getAccessToken() {
  if (accessToken) {
    logger.debug('Reusing existing simulated SailPoint token.', { service: 'SailPointService' });
    return accessToken;
  }

  logger.info('Simulating SailPoint token acquisition...', { service: 'SailPointService' });
  return new Promise(resolve => {
    setTimeout(() => {
      accessToken = `simulated-jwt-token-${Date.now()}`;
      // Avoid logging full token in real scenarios, or use a more secure logging level/transport
      logger.info('Simulated SailPoint Token acquired.', { service: 'SailPointService', tokenSuffix: accessToken.slice(-5) }); 
      resolve(accessToken);
    }, 100);
  });
}

/**
 * Simulates an authenticated GET request to the SailPoint API.
 */
async function sailPointGet(endpoint, params = {}) {
  const token = await getAccessToken();
  logger.info(`Simulating SailPoint GET: ${SAILPOINT_TENANT_URL}${endpoint}`, { 
    service: 'SailPointService', 
    endpoint, 
    params 
  });

  if (endpoint.startsWith('/v3/access-request-status')) {
    const sailpointActivityId = params.filters ? params.filters.split(' eq ')[1].replace(/"/g, '') : 'unknownActivityId';
    logger.debug(`Mocking GET /v3/access-request-status for ID: ${sailpointActivityId}`, { service: 'SailPointService' });
    return {
      data: { 
        id: sailpointActivityId,
        status: 'COMPLETED', 
        requestedItemsStatus: [{ id: "accessProfileId1", name: "Mock Access Profile", status: "APPROVED", type: "ACCESS_PROFILE" }],
        created: new Date().toISOString(),
        requester: { id: 'mockUserId', name: 'Mock Requesting User' }
      }
    };
  } else if (endpoint === '/v3/access-request-approvals/pending') {
    logger.debug('Mocking GET /v3/access-request-approvals/pending', { service: 'SailPointService' });
    return {
      data: [{
        id: "approvalId123",
        name: "Approve Access to Finance System",
        created: new Date(Date.now() - 86400000).toISOString(),
        request: { 
          requestId: "sailpointActivityId456",
          requester: { type: "IDENTITY", id: "userId2", name: "Jane Doe (SailPoint)" },
          requestedFor: [{ type: "IDENTITY", id: "userId3", name: "John Smith (SailPoint)" }],
          requestedItems: [{ id: "accessProfileId2", type: "ACCESS_PROFILE", name: "Finance System Access (SailPoint)" }],
        },
        requesterComment: "Request for finance access",
      }]
    };
  }
  logger.warn(`Unhandled GET endpoint in mock: ${endpoint}`, { service: 'SailPointService' });
  return { data: {} };
}

/**
 * Simulates an authenticated POST request to the SailPoint API.
 */
async function sailPointPost(endpoint, body) {
  const token = await getAccessToken();
  // Be cautious logging full body in production
  logger.info(`Simulating SailPoint POST: ${SAILPOINT_TENANT_URL}${endpoint}`, { 
    service: 'SailPointService', 
    endpoint, 
    body: Object.keys(body) // Log only keys or specific safe fields from body
  });

  if (endpoint === '/v3/access-requests') {
    const activityId = `task-sim-${Date.now()}`;
    logger.debug(`Mocking POST /v3/access-requests, generated activityId: ${activityId}`, { service: 'SailPointService' });
    return {
      status: 202, 
      data: { id: activityId, type: 'TASK_RESULT', status: 'PENDING' }
    };
  } else if (endpoint.includes('/approve')) {
    logger.debug(`Mocking POST ${endpoint} (approve action)`, { service: 'SailPointService' });
    return { status: 200, data: { status: 'approved', message: 'Request approved successfully (simulated)' } };
  } else if (endpoint.includes('/reject')) {
    logger.debug(`Mocking POST ${endpoint} (reject action)`, { service: 'SailPointService' });
    return { status: 200, data: { status: 'rejected', message: 'Request rejected successfully (simulated)' } };
  }
  logger.warn(`Unhandled POST endpoint in mock: ${endpoint}`, { service: 'SailPointService' });
  return { status: 404, data: { error: 'Endpoint not found (simulated)' } };
}

// --- In-memory store and identity simulation functions ---
const simulatedAccountsStore = {}; 
const simulatedIdentitiesStore = {}; 
let accountCounter = 0;
let identityCounter = 0;

const managerIdentityId = `simulated-identityId-${identityCounter++}`;
simulatedIdentitiesStore[managerIdentityId] = {
    id: managerIdentityId, name: "Jane Manager", email: "jane.manager@example.com",
    attributes: { displayName: "Jane Manager", mail: "jane.manager@example.com", department: "Management" },
    lifecycleState: 'active',
    accounts: [{ id: `sim-acc-mgr-${accountCounter++}`, nativeIdentity: 'janemgr', sourceId: 'AD', sourceName: 'Active Directory', status: 'enabled' }],
    access: [] 
};
const user1IdentityId = `simulated-identityId-${identityCounter++}`;
simulatedIdentitiesStore[user1IdentityId] = {
    id: user1IdentityId, name: "John Doe User", email: "john.doe.user@example.com",
    attributes: { displayName: "John Doe User", mail: "john.doe.user@example.com", department: "IT", title: "Developer" },
    lifecycleState: 'active', manager: { id: managerIdentityId, name: "Jane Manager" },
    accounts: [
        { id: `sim-acc-jd1-${accountCounter++}`, nativeIdentity: 'johndoe', sourceId: 'AD', sourceName: 'Active Directory', status: 'enabled' },
        { id: `sim-acc-jd2-${accountCounter++}`, nativeIdentity: 'jdoe', sourceId: 'Salesforce', sourceName: 'Salesforce CRM', status: 'enabled' }
    ],
    access: [
        { id: 'ap-contractor-base', type: 'ACCESS_PROFILE', name: 'Contractor Base Access', description: 'Basic network and email access for contractors.' },
        { id: 'role-developer-tools', type: 'ROLE', name: 'Developer Tools Suite', description: 'Access to standard developer applications.' }
    ]
};

function findIdentityById(identityId) {
  if (simulatedIdentitiesStore[identityId]) return simulatedIdentitiesStore[identityId];
  for (const key in simulatedIdentitiesStore) {
    if (simulatedIdentitiesStore[key].id === identityId) return simulatedIdentitiesStore[key];
  }
  return null;
}

async function simulateCreateAccount(accountData) {
  await getAccessToken(); 
  logger.info('Simulating SailPoint POST /v3/accounts', { 
    service: 'SailPointService', 
    action: 'simulateCreateAccount', 
    sourceId: accountData.sourceId,
    attributesToLog: Object.keys(accountData.attributes) // Log only keys
  });
  const taskId = `account-creation-task-${Date.now()}`;
  const accountId = `simulated-accountId-${accountCounter++}`;
  simulatedAccountsStore[taskId] = { status: 'QUEUED', accountId: accountId, accountData: accountData };
  const identityId = `simulated-identityId-${identityCounter++}`;
  const newIdentity = {
    id: identityId,
    name: accountData.attributes.displayName || `${accountData.attributes.givenName} ${accountData.attributes.sn || accountData.attributes.lastName}`,
    email: accountData.attributes.mail,
    attributes: { ...accountData.attributes }, 
    lifecycleState: 'active', sourceAccountId: accountId, 
    accounts: [{ id: accountId, nativeIdentity: accountData.attributes.sAMAccountName || accountId, sourceId: accountData.sourceId, sourceName: accountData.sourceId, status: 'enabled' }],
    access: []
  };
  simulatedIdentitiesStore[accountId] = newIdentity; // For lookup by accountId if needed during search
  simulatedIdentitiesStore[identityId] = newIdentity; // Primary lookup by identityId
  logger.debug(`Simulated account ${accountId} and identity ${identityId} linked for task ${taskId}`, { service: 'SailPointService', accountId, identityId, taskId });
  return {
    status: 202, 
    data: { id: taskId, type: 'ACCOUNT_ACTIVITY', status: 'QUEUED', name: `Create account for ${newIdentity.name}` }
  };
}

async function simulateGetTaskStatus(taskId) {
  await getAccessToken();
  logger.info(`Simulating SailPoint GET /v3/task-status/${taskId}`, { service: 'SailPointService', taskId });
  const taskDetails = simulatedAccountsStore[taskId] || simulatedIdentitiesStore[taskId]; 
  if (!taskDetails) {
    logger.warn(`Task ${taskId} not found (simulated).`, { service: 'SailPointService', taskId });
    return { status: 404, data: { message: `Task ${taskId} not found (simulated).` } };
  }
  logger.debug(`Current task status for ${taskId}: ${taskDetails.status}`, { service: 'SailPointService', taskId, currentStatus: taskDetails.status });
  if (taskDetails.status === 'QUEUED') {
    taskDetails.status = 'PROCESSING'; 
    logger.debug(`Task ${taskId} status changed to PROCESSING.`, { service: 'SailPointService', taskId });
  } else if (taskDetails.status === 'PROCESSING') {
    taskDetails.status = 'COMPLETED'; 
    logger.debug(`Task ${taskId} status changed to COMPLETED.`, { service: 'SailPointService', taskId });
  }
  const result = taskDetails.accountId ? { 
      accountId: taskDetails.accountId,
      identityId: (findIdentityById(taskDetails.accountId) || {}).id, // Attempt to find identity linked to accountId
      sourceName: taskDetails.accountData.sourceId, status: "success"
    } : { status: "success", message: `${taskDetails.name} completed successfully.` };
  return {
    status: 200,
    data: { id: taskId, type: taskDetails.type || 'GENERIC_TASK', name: taskDetails.name, status: taskDetails.status, result }
  };
}

async function simulateSearchIdentity(queryParams) {
  await getAccessToken();
  logger.info('Simulating SailPoint Identity Search', { service: 'SailPointService', queryParams });
  let identityToReturn = null;
  if (queryParams.email) {
    for (const key in simulatedIdentitiesStore) { 
      if (simulatedIdentitiesStore[key].email === queryParams.email) identityToReturn = simulatedIdentitiesStore[key];
    }
  } else if (queryParams.accountId) { 
    // This logic might need refinement if accountId is not a direct key in simulatedIdentitiesStore
    // For now, assuming it might be, or findIdentityById could be enhanced.
    identityToReturn = findIdentityById(queryParams.accountId) || Object.values(simulatedIdentitiesStore).find(id => id.sourceAccountId === queryParams.accountId);
  } else if (queryParams.identityId) {
    identityToReturn = findIdentityById(queryParams.identityId);
  }
  if (identityToReturn) {
    logger.debug(`Identity found for query: ${JSON.stringify(queryParams)}`, { service: 'SailPointService', identityId: identityToReturn.id });
    return { 
      status: 200, 
      data: [{ id: identityToReturn.id, name: identityToReturn.name, attributes: identityToReturn.attributes, lifecycleState: identityToReturn.lifecycleState, manager: identityToReturn.manager, accounts: identityToReturn.accounts }] 
    };
  } else {
    logger.warn(`Identity not found for query: ${JSON.stringify(queryParams)}`, { service: 'SailPointService' });
    return { status: 404, data: [] }; 
  }
}

async function simulateListAccountsByIdentity(identityId) {
  await getAccessToken();
  logger.info(`Simulating SailPoint GET /v3/accounts for identityId: ${identityId}`, { service: 'SailPointService', identityId });
  const identity = findIdentityById(identityId);
  if (identity && identity.accounts) {
    logger.debug(`Found ${identity.accounts.length} accounts for identity ${identityId}`, { service: 'SailPointService' });
    return { status: 200, data: identity.accounts };
  } else {
    logger.warn(`No accounts found for identity ${identityId} or identity not found.`, { service: 'SailPointService', identityId });
    return { status: 200, data: [] }; 
  }
}

async function simulateDisableAccount(accountId) {
  await getAccessToken();
  logger.info(`Simulating SailPoint POST /v3/accounts/${accountId}/disable`, { service: 'SailPointService', accountId });
  let targetAccount = null;
  let identityKeyForAccount = null;
  for (const idKey in simulatedIdentitiesStore) {
    const identity = simulatedIdentitiesStore[idKey];
    if (identity.accounts) {
      targetAccount = identity.accounts.find(acc => acc.id === accountId);
      if (targetAccount) { identityKeyForAccount = idKey; break; }
    }
  }
  if (!targetAccount) {
    logger.warn(`Account ${accountId} not found for disabling (simulated).`, { service: 'SailPointService', accountId });
    return { status: 404, data: { message: `Account ${accountId} not found for disabling (simulated).` } };
  }
  targetAccount.status = 'disabled'; 
  if (simulatedIdentitiesStore[identityKeyForAccount]) {
      const accIndex = simulatedIdentitiesStore[identityKeyForAccount].accounts.findIndex(a => a.id === accountId);
      if (accIndex > -1) simulatedIdentitiesStore[identityKeyForAccount].accounts[accIndex].status = 'disabled';
  }
  logger.info(`Account ${accountId} status set to 'disabled' in mock store.`, { service: 'SailPointService', accountId });
  const taskId = `disable-account-task-${Date.now()}`;
  simulatedAccountsStore[taskId] = { status: 'QUEUED', accountId: accountId, type: 'ACCOUNT_DISABLE_TASK', name: `Disable account ${accountId}` };
  return {
    status: 202, 
    data: { id: taskId, type: 'ACCOUNT_ACTIVITY', status: 'QUEUED', name: `Disable account ${accountId}` }
  };
}

async function simulateSetLifecycleState(identityId, newLifecycleState) {
  await getAccessToken();
  logger.info(`Simulating SailPoint set lifecycle state for identity ${identityId} to ${newLifecycleState}`, { service: 'SailPointService', identityId, newLifecycleState });
  const identity = findIdentityById(identityId);
  if (!identity) {
    logger.warn(`Identity ${identityId} not found for lifecycle state change (simulated).`, { service: 'SailPointService', identityId });
    return { status: 404, data: { message: `Identity ${identityId} not found for lifecycle state change (simulated).` } };
  }
  identity.lifecycleState = newLifecycleState; 
  logger.info(`Identity ${identityId} lifecycle state updated to ${newLifecycleState} in mock store.`, { service: 'SailPointService', identityId });
  if (newLifecycleState === 'terminated' && identity.accounts) {
    identity.accounts.forEach(acc => acc.status = 'disabled');
    logger.info(`Accounts for identity ${identityId} also marked as disabled due to termination.`, { service: 'SailPointService', identityId });
  }
  const taskId = `set-lcs-task-${Date.now()}`;
  simulatedIdentitiesStore[taskId] = { status: 'QUEUED', identityId: identityId, type: 'LIFECYCLE_STATE_CHANGE_TASK', name: `Set lifecycle state to ${newLifecycleState} for ${identity.name}` };
  return {
    status: 202, 
    data: { id: taskId, type: 'IDENTITY_LIFECYCLE_UPDATE', status: 'QUEUED', name: `Lifecycle state change for ${identity.name} to ${newLifecycleState}` }
  };
}

async function simulateGetUserDetails(sailpointIdentityId) {
  await getAccessToken();
  logger.info(`Simulating SailPoint Get User Details for identity ID: ${sailpointIdentityId}`, { service: 'SailPointService', sailpointIdentityId });
  const identity = findIdentityById(sailpointIdentityId);
  if (identity) {
    const searchResult = await simulateSearchIdentity({ identityId: sailpointIdentityId });
    if (searchResult.status === 200 && searchResult.data.length > 0) {
        logger.debug(`User details found for ${sailpointIdentityId}.`, { service: 'SailPointService' });
        return { status: 200, data: searchResult.data[0] }; 
    }
  }
  logger.warn(`User details not found for ID ${sailpointIdentityId} (simulated).`, { service: 'SailPointService', sailpointIdentityId });
  return { status: 404, data: { message: `User details not found for ID ${sailpointIdentityId} (simulated).` } };
}

async function simulateGetUserEntitlements(sailpointIdentityId) {
  await getAccessToken();
  logger.info(`Simulating SailPoint Get User Entitlements for ID: ${sailpointIdentityId}`, { service: 'SailPointService', sailpointIdentityId });
  const identity = findIdentityById(sailpointIdentityId);
  if (identity && identity.access) {
    logger.debug(`Found ${identity.access.length} access items for identity ${sailpointIdentityId}.`, { service: 'SailPointService' });
    return { status: 200, data: identity.access };
  } else if (identity) {
    logger.debug(`User ${sailpointIdentityId} exists but has no access items.`, { service: 'SailPointService' });
    return { status: 200, data: [] }; 
  }
  logger.warn(`Entitlements not found for user ID ${sailpointIdentityId} (simulated user not found).`, { service: 'SailPointService', sailpointIdentityId });
  return { status: 404, data: { message: `Entitlements not found for user ID ${sailpointIdentityId} (simulated user not found).` } };
}

module.exports = {
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
};
