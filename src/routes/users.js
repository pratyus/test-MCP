const express = require('express');
const router = express.Router();
const { 
  simulateGetUserDetails,
  simulateGetUserEntitlements 
} = require('../services/sailpointService');
const logger = require('../utils/logger');
const { BadRequestError, NotFoundError, ApiError } = require('../utils/errors');

/**
 * GET /mcp/api/v1/users/{sailpointIdentityId}
 * Retrieves basic details for a specific user (identity).
 */

/**
 * @openapi
 * /users/{sailpointIdentityId}:
 *   get:
 *     tags:
 *       - User Information
 *     summary: Get user details by SailPoint Identity ID
 *     description: Retrieves basic details for a specific user (identity), including their display name, email, lifecycle state, manager, and associated source accounts.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sailpointIdentityId
 *         required: true
 *         schema:
 *           type: string
 *         description: The SailPoint Identity ID of the user.
 *     responses:
 *       '200':
 *         description: Successful response with user details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:sailpointIdentityId', async (req, res, next) => {
  try {
    const { sailpointIdentityId } = req.params;
    logger.info(`Request to get user details for ID: ${sailpointIdentityId}`, { service: 'UsersRoute', sailpointIdentityId });

    if (!sailpointIdentityId) {
      throw new BadRequestError('sailpointIdentityId parameter is required.');
    }

    const response = await simulateGetUserDetails(sailpointIdentityId);

    if (response.status === 200 && response.data && response.data.id) { // Check for data.id to ensure user object is there
      const sailpointUser = response.data;
      logger.debug(`Successfully retrieved user details for ID: ${sailpointIdentityId} from service.`, { service: 'UsersRoute', sailpointIdentityId });
      // Transform SailPoint's response to MCP's defined User model
      // MCP User Model:
      // {
      //   "id": "sailpointIdentityId123",
      //   "displayName": "John Doe",
      //   "email": "john.doe@example.com",
      //   "lifecycleState": "active",
      //   "manager": { "id": "managerSailPointId456", "displayName": "Jane Smith" },
      //   "accounts": [ { "accountId": "sourceAccountId1", "sourceName": "Active Directory", "nativeIdentity": "johndoe" } ]
      // }
      // SailPoint mock (simulateGetUserDetails via simulateSearchIdentity) returns:
      // { id, name, attributes, lifecycleState, manager, accounts }
      
      const mcpUser = {
        id: sailpointUser.id,
        displayName: sailpointUser.name || sailpointUser.attributes?.displayName,
        email: sailpointUser.attributes?.mail || sailpointUser.attributes?.email, // Handle variations
        lifecycleState: sailpointUser.lifecycleState,
        manager: sailpointUser.manager ? { // SailPoint manager object might be { id, name, type }
          id: sailpointUser.manager.id,
          displayName: sailpointUser.manager.name 
        } : undefined,
        accounts: sailpointUser.accounts ? sailpointUser.accounts.map(acc => ({
          accountId: acc.id, 
          sourceName: acc.sourceName,
          nativeIdentity: acc.nativeIdentity
        })) : []
      };
      res.status(200).json(mcpUser);
    } else {
      logger.warn(`User not found or failed to retrieve details for ID: ${sailpointIdentityId}. Status: ${response.status}`, { 
        service: 'UsersRoute', 
        sailpointIdentityId, 
        sailpointStatus: response.status, 
        sailpointResponse: response.data 
      });
      throw new NotFoundError(`User details not found for ID ${sailpointIdentityId}.`);
    }
  } catch (error) {
    logger.error(`Error in GET /users/${req.params.sailpointIdentityId} route`, { service: 'UsersRoute', error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * GET /mcp/api/v1/users/{sailpointIdentityId}/entitlements
 * Retrieves a list of entitlements (access profiles/roles) held by a specific user.
 */

/**
 * @openapi
 * /users/{sailpointIdentityId}/entitlements:
 *   get:
 *     tags:
 *       - User Information
 *     summary: Get user entitlements by SailPoint Identity ID
 *     description: Retrieves a list of entitlements (represented as Access Profiles, Roles, or direct Entitlements) held by a specific user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sailpointIdentityId
 *         required: true
 *         schema:
 *           type: string
 *         description: The SailPoint Identity ID of the user.
 *     responses:
 *       '200':
 *         description: Successful response with a list of user entitlements.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserEntitlementsResponse'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:sailpointIdentityId/entitlements', async (req, res, next) => {
  try {
    const { sailpointIdentityId } = req.params;
    logger.info(`Request to get user entitlements for ID: ${sailpointIdentityId}`, { service: 'UsersRoute', sailpointIdentityId });

    if (!sailpointIdentityId) {
      throw new BadRequestError('sailpointIdentityId parameter is required.');
    }

    const response = await simulateGetUserEntitlements(sailpointIdentityId);

    if (response.status === 200 && Array.isArray(response.data)) {
      const sailpointEntitlements = response.data;
      logger.debug(`Successfully retrieved ${sailpointEntitlements.length} entitlements for ID: ${sailpointIdentityId} from service.`, { service: 'UsersRoute', sailpointIdentityId, count: sailpointEntitlements.length });
      // Transform SailPoint's response to MCP's defined Entitlement model
      // MCP Entitlement Model:
      // {
      //   "id": "entitlementIdOrAccessProfileId1",
      //   "type": "ACCESS_PROFILE", // Or "ENTITLEMENT", "ROLE"
      //   "name": "Contractor Base Access",
      //   "description": "Basic access for all contractors",
      //   "source": "Active Directory" // If applicable
      // }
      // SailPoint mock (simulateGetUserEntitlements) returns:
      // { id, type, name, description, source (optional) } - This is already aligned.
      
      const mcpEntitlements = sailpointEntitlements.map(ent => ({
        id: ent.id,
        type: ent.type,
        name: ent.name,
        description: ent.description,
        source: ent.source // Optional, might not always be present
      }));
      res.status(200).json(mcpEntitlements);
    } else {
      logger.warn(`User entitlements not found or failed to retrieve for ID: ${sailpointIdentityId}. Status: ${response.status}`, { 
        service: 'UsersRoute', 
        sailpointIdentityId, 
        sailpointStatus: response.status, 
        sailpointResponse: response.data 
      });
      // Check if the user themselves was not found by simulateGetUserEntitlements, or just no entitlements
      if (response.data && response.data.message && response.data.message.includes('user not found')) {
          throw new NotFoundError(`User not found with ID ${sailpointIdentityId} when fetching entitlements.`);
      }
      throw new ApiError(response.status || 500, 'Failed to retrieve user entitlements from SailPoint.', true, { details: response.data });
    }
  } catch (error) {
    logger.error(`Error in GET /users/${req.params.sailpointIdentityId}/entitlements route`, { service: 'UsersRoute', error: error.message, stack: error.stack });
    next(error);
  }
});

module.exports = router;
