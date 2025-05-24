const express = require('express');
const router = express.Router();
const sailpointService = require('../services/sailpointService');
const logger = require('../utils/logger');
const { BadRequestError } = require('../utils/errors');

/**
 * POST /mcp/api/v1/requests
 * Submits an access request.
 */

/**
 * @openapi
 * /requests:
 *   post:
 *     tags:
 *       - Access Requests
 *     summary: Submit an access request
 *     description: Submits an access request for one or more identities to one or more access items (Access Profiles, Roles, or Entitlements).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AccessRequestInput'
 *     responses:
 *       '202':
 *         description: Access request submitted successfully and is being processed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccessRequestResponse'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/', async (req, res, next) => {
  try {
    const { requestedFor, items, justification } = req.body;
    logger.info('Received request to submit access', { 
      service: 'AccessRequestsRoute', 
      requestedForCount: requestedFor ? requestedFor.length : 0, 
      itemCount: items ? items.length : 0 
    });

    if (!requestedFor || !Array.isArray(requestedFor) || requestedFor.length === 0) {
      throw new BadRequestError('requestedFor is required and must be a non-empty array.');
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestError('items is required and must be a non-empty array.');
    }

    // Construct payload for SailPoint's /v3/access-requests
    // MCP's "items" maps to SailPoint's "requestedItems"
    // MCP's "justification" might be logged internally or added to each item's comment if SailPoint supports it.
    // For this simulation, we'll assume comments are per item.
    const sailPointPayload = {
      requestedFor: requestedFor, // Array of SailPoint Identity IDs
      requestType: 'GRANT_ACCESS', // Assuming GRANT_ACCESS for now as per design
      requestedItems: items.map(item => ({
        id: item.id,
        type: item.type,
        comment: item.comment || justification, // Use item comment or overall justification
      })),
    };

    const response = await sailpointService.sailPointPost('/v3/access-requests', sailPointPayload);

    if (response.status === 202 && response.data && response.data.id) {
      logger.info('Access request submitted successfully to SailPoint.', { 
        service: 'AccessRequestsRoute', 
        sailpointActivityId: response.data.id 
      });
      res.status(202).json({
        requestId: response.data.id, 
        status: 'PENDING',
        message: 'Access request submitted successfully. Status can be tracked.'
      });
    } else {
      logger.warn('Failed to submit access request to SailPoint or unexpected response.', { 
        service: 'AccessRequestsRoute', 
        sailpointStatus: response.status, 
        sailpointResponse: response.data 
      });
      // Create an ApiError or use a default for forwarding
      const error = new Error('Failed to submit access request to SailPoint.');
      error.statusCode = response.status || 500;
      error.details = response.data;
      return next(error);
    }
  } catch (error) {
    logger.error('Error in access request submission route', { service: 'AccessRequestsRoute', error: error.message, stack: error.stack });
    next(error); // Pass to centralized error handler
  }
});

/**
 * GET /mcp/api/v1/requests/status/:sailpointActivityId
 * Retrieves the status of a previously submitted access request.
 */

/**
 * @openapi
 * /requests/status/{sailpointActivityId}:
 *   get:
 *     tags:
 *       - Access Requests
 *     summary: Get access request status
 *     description: Retrieves the current status of an asynchronously processed access request using the ID returned by SailPoint.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sailpointActivityId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the SailPoint activity/task tracking the access request.
 *     responses:
 *       '200':
 *         description: Successful response with the access request status.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AccessRequestStatusResponse'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/status/:sailpointActivityId', async (req, res, next) => {
  try {
    const { sailpointActivityId } = req.params;
    logger.info(`Received request for status of SailPoint activity ID: ${sailpointActivityId}`, { service: 'AccessRequestsRoute', sailpointActivityId });

    if (!sailpointActivityId) {
      throw new BadRequestError('sailpointActivityId parameter is required.');
    }

    // Construct parameters for SailPoint's GET /v3/access-request-status
    // The design document mentions: GET /v3/access-request-status?filters=id eq "{sailpointActivityId}"
    // The sailpointService mock for this endpoint expects params.filters
    const sailPointParams = {
      filters: `id eq "${sailpointActivityId}"` // Ensure quotes if SailPoint expects string literal
    };

    const response = await sailpointService.sailPointGet(`/v3/access-request-status`, sailPointParams);
    
    // Assuming sailpointService.sailPointGet returns an object with a 'data' property containing the SailPoint response
    const sailpointData = response.data;

    if (sailpointData && sailpointData.id) {
      logger.debug(`Successfully retrieved status for SailPoint activity ID: ${sailpointActivityId}`, { service: 'AccessRequestsRoute', sailpointActivityId });
      const mcpResponse = {
        requestId: sailpointData.id,
        status: sailpointData.status, 
        requestedItems: sailpointData.requestedItemsStatus ? sailpointData.requestedItemsStatus.map(item => ({
          id: item.id,
          type: item.type,
          name: item.name, 
          status: item.status 
        })) : [],
        created: sailpointData.created,
        requester: sailpointData.requester ? { id: sailpointData.requester.id, name: sailpointData.requester.name } : undefined
      };
      res.status(200).json(mcpResponse);
    } else {
      logger.warn(`Access request status not found or failed to retrieve for ID: ${sailpointActivityId}`, { 
        service: 'AccessRequestsRoute', 
        sailpointActivityId, 
        sailpointStatus: response.status, 
        sailpointResponse: sailpointData 
      });
      const error = new Error('Access request status not found or failed to retrieve from SailPoint.');
      error.statusCode = response.status || 404;
      error.details = sailpointData;
      return next(error);
    }
  } catch (error) {
    logger.error(`Error retrieving status for SailPoint activity ID: ${req.params.sailpointActivityId}`, { service: 'AccessRequestsRoute', error: error.message, stack: error.stack });
    next(error); // Pass to centralized error handler
  }
});

module.exports = router;
