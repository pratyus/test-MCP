const express = require('express');
const router = express.Router();
const { 
  simulateCreateAccount, 
  simulateGetTaskStatus, 
  simulateSearchIdentity,
  sailPointPost, // For initial access requests
  simulateSetLifecycleState
} = require('../services/sailpointService');
const logger = require('../utils/logger');
const { BadRequestError, ApiError } = require('../utils/errors');


// Helper function to simulate polling for task completion
function pollTaskStatus(taskId, attempts = 5, delay = 200) {
  return new Promise(async (resolve, reject) => {
    for (let i = 0; i < attempts; i++) {
      try {
        const taskResponse = await simulateGetTaskStatus(taskId);
        logger.debug(`Polling task ${taskId}, attempt ${i+1}, status: ${taskResponse.data.status}`, { service: 'ContractorsRoutePolling', taskId });
        if (taskResponse.data && taskResponse.data.status === 'COMPLETED') {
          return resolve(taskResponse.data);
        }
      } catch (error) {
        logger.warn(`Error polling task ${taskId}, attempt ${i+1}: ${error.message}`, { service: 'ContractorsRoutePolling', taskId, error });
      }
      await new Promise(res => setTimeout(res, delay));
    }
    reject(new ApiError(500, `Task ${taskId} did not complete after ${attempts} attempts.`));
  });
}


/**
 * POST /mcp/api/v1/contractors/onboard
 * Onboards a new contractor.
 */

/**
 * @openapi
 * /contractors/onboard:
 *   post:
 *     tags:
 *       - Contractor Lifecycle
 *     summary: Onboard a new contractor
 *     description: Initiates the onboarding process for a new contractor. This involves creating a user account in a designated source (simulated) and assigning initial entitlements/access profiles.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContractorOnboardInput'
 *     responses:
 *       '202':
 *         description: Contractor onboarding process initiated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContractorOnboardResponse'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/onboard', async (req, res, next) => {
  const { firstName, lastName, email, managerSailPointId, attributes, initialAccess, endDate } = req.body;
  const mcpTrackingId = `mcp-onboarding-${Date.now()}`;
  logger.info(`MCP Onboarding Process ${mcpTrackingId} started for ${email}`, { service: 'ContractorsRoute', email, mcpTrackingId });

  try {
    // Basic validation
    if (!firstName || !lastName || !email || !managerSailPointId || !attributes) {
      throw new BadRequestError('Missing required fields for contractor onboarding.');
    }

    // 1. Simulate creating an account in SailPoint
    // The attributes for SailPoint's /v3/accounts should be under an 'attributes' key in the payload.
    // The MCP request body already has an 'attributes' field for source-specific attributes.
    const sailpointAccountPayload = {
      sourceId: process.env.SAILPOINT_CONTRACTOR_SOURCE_ID || 'mockContractorSourceId', 
      attributes: {
        ...attributes, 
        mail: email,
        displayName: `${firstName} ${lastName}`,
        givenName: firstName, 
        sn: lastName, 
        manager: managerSailPointId, 
      },
    };

    logger.debug(`Step 1 (Onboard ${email}): Attempting to create account.`, { service: 'ContractorsRoute', mcpTrackingId, payloadKeys: Object.keys(sailpointAccountPayload.attributes) });
    const accountCreationResponse = await simulateCreateAccount(sailpointAccountPayload);
    const accountCreationTaskId = accountCreationResponse.data.id;
    logger.info(`Step 1 (Onboard ${email}): Account creation task submitted. Task ID: ${accountCreationTaskId}`, { service: 'ContractorsRoute', mcpTrackingId, accountCreationTaskId });

    // 2. (Simulate) Polling for account creation completion
    logger.info(`Step 2 (Onboard ${email}): Polling for account creation task ${accountCreationTaskId} completion...`, { service: 'ContractorsRoute', mcpTrackingId });
    const taskResult = await pollTaskStatus(accountCreationTaskId);
    
    if (!taskResult || taskResult.status !== 'COMPLETED' || !taskResult.result || !taskResult.result.accountId) {
      logger.error(`Account creation task ${accountCreationTaskId} did not complete successfully or returned unexpected result.`, { service: 'ContractorsRoute', mcpTrackingId, taskResult });
      throw new ApiError(500, 'Contractor account creation failed at SailPoint (simulated).', true, { mcpTrackingId, details: taskResult });
    }
    const newSailPointAccountId = taskResult.result.accountId;
    logger.info(`Step 2 (Onboard ${email}): Account successfully created. Account ID: ${newSailPointAccountId}`, { service: 'ContractorsRoute', mcpTrackingId, newSailPointAccountId });

    // 3. Simulate finding/looking up the SailPoint identity
    let newContractorIdentityId = taskResult.result.identityId;

    if (!newContractorIdentityId) {
        logger.info(`Step 3 (Onboard ${email}): Identity ID not in task result, searching for identity linked to account ${newSailPointAccountId} or email ${email}...`, { service: 'ContractorsRoute', mcpTrackingId });
        const identitySearchResponse = await simulateSearchIdentity({ accountId: newSailPointAccountId });
        if (identitySearchResponse.data && identitySearchResponse.data.length > 0) {
            newContractorIdentityId = identitySearchResponse.data[0].id;
        } else {
            logger.info(`Step 3a (Onboard ${email}): Identity not found by accountId, trying by email ${email}...`, { service: 'ContractorsRoute', mcpTrackingId });
            const identitySearchByEmailResponse = await simulateSearchIdentity({ email: email });
            if (identitySearchByEmailResponse.data && identitySearchByEmailResponse.data.length > 0) {
                newContractorIdentityId = identitySearchByEmailResponse.data[0].id;
            }
        }
    }

    if (!newContractorIdentityId) {
      logger.error(`Failed to find or lookup SailPoint identity for the new contractor ${email}.`, { service: 'ContractorsRoute', mcpTrackingId, email });
      throw new ApiError(500, 'Failed to retrieve SailPoint identity for the new contractor (simulated).', true, { mcpTrackingId });
    }
    logger.info(`Step 3 (Onboard ${email}): SailPoint Identity ID found/created: ${newContractorIdentityId}`, { service: 'ContractorsRoute', mcpTrackingId, newContractorIdentityId });

    // 4. For each item in initialAccess, submit an access request
    if (initialAccess && Array.isArray(initialAccess) && initialAccess.length > 0) {
      logger.info(`Step 4 (Onboard ${email}): Submitting ${initialAccess.length} initial access requests for identity ${newContractorIdentityId}...`, { service: 'ContractorsRoute', mcpTrackingId });
      for (const accessItem of initialAccess) {
        const itemType = typeof accessItem === 'string' ? 'ACCESS_PROFILE' : accessItem.type;
        const itemId = typeof accessItem === 'string' ? accessItem : accessItem.id;
        
        const accessRequestPayload = {
          requestedFor: [newContractorIdentityId],
          requestType: 'GRANT_ACCESS',
          requestedItems: [{ id: itemId, type: itemType, comment: 'Initial access for new contractor.' }]
        };
        try {
          const arResponse = await sailPointPost('/v3/access-requests', accessRequestPayload);
          logger.info(`Initial access request submitted for item ${itemId}. SailPoint Activity ID: ${arResponse.data.id}`, { service: 'ContractorsRoute', mcpTrackingId, itemId, sailpointActivityId: arResponse.data.id });
        } catch (arError) {
          logger.error(`Failed to submit initial access request for item ${itemId} for identity ${newContractorIdentityId}.`, { service: 'ContractorsRoute', mcpTrackingId, itemId, error: arError.message });
          // Continue trying other access items
        }
      }
    } else {
      logger.info(`Step 4 (Onboard ${email}): No initial access items requested.`, { service: 'ContractorsRoute', mcpTrackingId });
    }
    
    // TODO (Future): Handle 'endDate' for actual lifecycle state scheduling if API allows direct date setting for LCS transitions.

    // 5. Return response
    logger.info(`MCP Onboarding Process ${mcpTrackingId} completed successfully for ${email}.`, { service: 'ContractorsRoute', mcpTrackingId });
    res.status(202).json({
      status: 'PENDING', 
      message: 'Contractor onboarding process initiated successfully (simulated).',
      mcpTrackingId,
      sailpointAccountId: newSailPointAccountId,
      sailpointIdentityId: newContractorIdentityId
    });

  } catch (error) {
    logger.error(`Error during contractor onboarding process ${mcpTrackingId} for ${email}.`, { service: 'ContractorsRoute', mcpTrackingId, error: error.message, stack: error.stack });
    next(error); // Pass to centralized error handler
  }
});


/**
 * POST /mcp/api/v1/contractors/offboard
 * Offboards a contractor.
 */

/**
 * @openapi
 * /contractors/offboard:
 *   post:
 *     tags:
 *       - Contractor Lifecycle
 *     summary: Offboard a contractor
 *     description: Initiates the offboarding process for a contractor. This typically involves disabling the user's account(s) by setting their lifecycle state to 'terminated' (simulated).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContractorOffboardInput'
 *     responses:
 *       '202':
 *         description: Contractor offboarding process initiated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContractorOffboardResponse'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/offboard', async (req, res, next) => {
  const { contractorSailPointIdentityId, justification, revokeAllAccess } = req.body;
  const mcpTrackingId = `mcp-offboarding-${Date.now()}`;
  logger.info(`MCP Offboarding Process ${mcpTrackingId} started for identity ${contractorSailPointIdentityId}`, { service: 'ContractorsRoute', contractorSailPointIdentityId, mcpTrackingId, justification, revokeAllAccess });
  
  try {
    if (!contractorSailPointIdentityId) {
      throw new BadRequestError('contractorSailPointIdentityId is required.');
    }

    // Preferred Path: Trigger Lifecycle State Change
    const terminatedLifecycleState = process.env.SAILPOINT_TERMINATED_LCS || 'terminated'; 
    
    logger.info(`Step 1 (Offboard ${contractorSailPointIdentityId}): Attempting to set lifecycle state to '${terminatedLifecycleState}'.`, { service: 'ContractorsRoute', mcpTrackingId });
    const lcsResponse = await simulateSetLifecycleState(contractorSailPointIdentityId, terminatedLifecycleState);
    const lcsChangeTaskId = lcsResponse.data.id;
    logger.info(`Step 1 (Offboard ${contractorSailPointIdentityId}): Lifecycle state change task submitted. Task ID: ${lcsChangeTaskId}`, { service: 'ContractorsRoute', mcpTrackingId, lcsChangeTaskId });

    logger.info(`Step 2 (Offboard ${contractorSailPointIdentityId}): Polling for lifecycle state change task ${lcsChangeTaskId} completion...`, { service: 'ContractorsRoute', mcpTrackingId });
    const taskResult = await pollTaskStatus(lcsChangeTaskId); 

    if (!taskResult || taskResult.status !== 'COMPLETED') {
      logger.error(`Lifecycle state change task ${lcsChangeTaskId} did not complete successfully for identity ${contractorSailPointIdentityId}.`, { service: 'ContractorsRoute', mcpTrackingId, taskResult });
      throw new ApiError(500, 'Contractor offboarding failed at SailPoint (simulated lifecycle state change).', true, { mcpTrackingId, details: taskResult });
    }
    logger.info(`Step 2 (Offboard ${contractorSailPointIdentityId}): Lifecycle state successfully set to '${terminatedLifecycleState}'.`, { service: 'ContractorsRoute', mcpTrackingId });

    if (revokeAllAccess) {
      logger.info(`'revokeAllAccess' is true for ${contractorSailPointIdentityId}. Lifecycle state '${terminatedLifecycleState}' is expected to handle comprehensive access revocation.`, { service: 'ContractorsRoute', mcpTrackingId });
    }

    res.status(202).json({
      status: 'PENDING', 
      message: 'Contractor offboarding process initiated successfully (simulated).',
      mcpTrackingId,
      sailpointTaskActivityId: lcsChangeTaskId
    });

  } catch (error) {
    logger.error(`Error during contractor offboarding process ${mcpTrackingId} for ${contractorSailPointIdentityId}.`, { service: 'ContractorsRoute', mcpTrackingId, error: error.message, stack: error.stack });
    next(error);
  }
});


module.exports = router;
