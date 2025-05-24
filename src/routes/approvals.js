const express = require('express');
const router = express.Router();
const sailpointService = require('../services/sailpointService');
const logger = require('../utils/logger');
const { BadRequestError, ApiError } = require('../utils/errors');

/**
 * GET /mcp/api/v1/approvals/pending
 * Retrieves a list of pending access request approvals for the authenticated user.
 */

/**
 * @openapi
 * /approvals/pending:
 *   get:
 *     tags:
 *       - Approvals
 *     summary: List pending approvals
 *     description: Retrieves a list of access request approvals that are pending action by the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: A list of pending approval items.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PendingApprovalsResponse'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/pending', async (req, res, next) => {
  try {
    // Assuming req.user.sailpointIdentityId is populated by authMiddleware
    const approverId = req.user ? req.user.sailpointIdentityId : 'unknownApprover';
    logger.info(`Fetching pending approvals for user: ${approverId}`, { service: 'ApprovalsRoute', approverId });

    // The sailpointService.sailPointGet mock for '/v3/access-request-approvals/pending'
    // currently returns a generic list. In a real scenario, you might pass approverId as a param.
    const response = await sailpointService.sailPointGet('/v3/access-request-approvals/pending' /*, { ownerId: approverId } */);
    const sailpointApprovals = response.data;

    if (Array.isArray(sailpointApprovals)) {
      logger.debug(`Retrieved ${sailpointApprovals.length} pending approvals from SailPoint service.`, { service: 'ApprovalsRoute', count: sailpointApprovals.length });
      const mcpApprovals = sailpointApprovals.map(approval => {
        // The MCP design for a pending approval item:
        // {
        //   "approvalId": "approvalId123",
        //   "request": {
        //     "requestId": "sailpointActivityId456",
        //     "requester": { "id": "userId2", "name": "Jane Doe" },
        //     "requestedFor": { "id": "userId3", "name": "John Smith" },
        //     "item": { "id": "accessProfileId2", "type": "ACCESS_PROFILE", "name": "Finance System Access" },
        //     "dateRequested": "2023-10-26T14:30:00Z"
        //   },
        //   "comment": "Request for finance access" // This is likely the requesterComment from SailPoint
        // }
        // The sailpointService mock provides:
        // {
        //   id: "approvalId123",
        //   name: "Approve Access to Finance System", // Name of the approval item
        //   request: {
        //     requestId: "sailpointActivityId456",
        //     requester: { type: "IDENTITY", id: "userId2", name: "Jane Doe (SailPoint)" },
        //     requestedFor: [{ type: "IDENTITY", id: "userId3", name: "John Smith (SailPoint)" }], // Note: SailPoint returns an array for requestedFor
        //     requestedItems: [{ id: "accessProfileId2", type: "ACCESS_PROFILE", name: "Finance System Access (SailPoint)" }], // Note: SailPoint returns an array
        //     dateRequested: new Date(Date.now() - 86400000).toISOString()
        //   },
        //  requesterComment: "Request for finance access"
        // }

        const spRequest = approval.request || {};
        const spRequester = spRequest.requester || {};
        // MCP design expects a single requestedFor, SailPoint's mock has an array. Take the first for simplicity.
        const spRequestedFor = Array.isArray(spRequest.requestedFor) && spRequest.requestedFor.length > 0 ? spRequest.requestedFor[0] : {};
        // MCP design expects a single item for the approval context, SailPoint's mock has requestedItems array. Take the first.
        const spItem = Array.isArray(spRequest.requestedItems) && spRequest.requestedItems.length > 0 ? spRequest.requestedItems[0] : {};


        return {
          approvalId: approval.id,
          request: {
            requestId: spRequest.requestId,
            requester: {
              id: spRequester.id,
              name: spRequester.name
            },
            requestedFor: {
              id: spRequestedFor.id,
              name: spRequestedFor.name
            },
            item: {
              id: spItem.id,
              type: spItem.type,
              name: spItem.name
            },
            dateRequested: spRequest.dateRequested || approval.created // Fallback if dateRequested not in request block
          },
          comment: approval.requesterComment || approval.name // Fallback to approval name if no specific comment
        };
      });
      res.status(200).json(mcpApprovals);
    } else {
      logger.warn('Failed to retrieve pending approvals or data format unexpected.', { 
        service: 'ApprovalsRoute', 
        sailpointStatus: response.status, 
        sailpointResponse: sailpointApprovals 
      });
      return next(new ApiError(response.status || 500, 'Failed to retrieve pending approvals from SailPoint or data format unexpected.', true, { details: sailpointApprovals }));
    }
  } catch (error) {
    logger.error('Error in GET /pending approvals route', { service: 'ApprovalsRoute', error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /mcp/api/v1/approvals/:approvalId/approve
 * Approves a pending access request.
 */

/**
 * @openapi
 * /approvals/{approvalId}/approve:
 *   post:
 *     tags:
 *       - Approvals
 *     summary: Approve an access request
 *     description: Approves a specific pending access request.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: approvalId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the approval item to approve.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApprovalActionInput'
 *     responses:
 *       '200':
 *         description: Approval successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApprovalOutcomeResponse'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound' # If approvalId doesn't exist
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/:approvalId/approve', async (req, res, next) => {
  try {
    const { approvalId } = req.params;
    const { comment } = req.body;
    const approver = req.user ? req.user.username : 'unknownApprover';
    logger.info(`Attempting to approve request ${approvalId} by ${approver}`, { service: 'ApprovalsRoute', approvalId, approver, commentLength: comment ? comment.length : 0 });

    if (!approvalId) {
      throw new BadRequestError('approvalId parameter is required.');
    }
    if (!comment) {
      throw new BadRequestError('Comment is required for approval.');
    }

    const sailPointPayload = { comment };
    const response = await sailpointService.sailPointPost(`/v3/access-request-approvals/${approvalId}/approve`, sailPointPayload);

    if (response.status === 200) {
      logger.info(`Approval ${approvalId} processed successfully by SailPoint service.`, { service: 'ApprovalsRoute', approvalId });
      res.status(200).json({
        status: 'SUCCESS',
        message: 'Approval submitted successfully (simulated).'
      });
    } else {
      logger.warn(`Failed to approve access request ${approvalId} via SailPoint.`, { 
        service: 'ApprovalsRoute', 
        approvalId, 
        sailpointStatus: response.status, 
        sailpointResponse: response.data 
      });
      return next(new ApiError(response.status || 500, 'Failed to approve access request via SailPoint.', true, { details: response.data }));
    }
  } catch (error) {
    logger.error(`Error in POST /approve request for ${req.params.approvalId}`, { service: 'ApprovalsRoute', error: error.message, stack: error.stack });
    next(error);
  }
});

/**
 * POST /mcp/api/v1/approvals/:approvalId/reject
 * Rejects a pending access request.
 */

/**
 * @openapi
 * /approvals/{approvalId}/reject:
 *   post:
 *     tags:
 *       - Approvals
 *     summary: Reject an access request
 *     description: Rejects a specific pending access request.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: approvalId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the approval item to reject.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApprovalActionInput'
 *     responses:
 *       '200':
 *         description: Rejection successful.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApprovalOutcomeResponse'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound' # If approvalId doesn't exist
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/:approvalId/reject', async (req, res, next) => {
  try {
    const { approvalId } = req.params;
    const { comment } = req.body;
    const approver = req.user ? req.user.username : 'unknownApprover';
    logger.info(`Attempting to reject request ${approvalId} by ${approver}`, { service: 'ApprovalsRoute', approvalId, approver, commentLength: comment ? comment.length : 0 });

    if (!approvalId) {
      throw new BadRequestError('approvalId parameter is required.');
    }
    if (!comment) {
      throw new BadRequestError('Comment is required for rejection.');
    }

    const sailPointPayload = { comment };
    const response = await sailpointService.sailPointPost(`/v3/access-request-approvals/${approvalId}/reject`, sailPointPayload);

    if (response.status === 200) {
      logger.info(`Rejection for ${approvalId} processed successfully by SailPoint service.`, { service: 'ApprovalsRoute', approvalId });
      res.status(200).json({
        status: 'SUCCESS',
        message: 'Rejection submitted successfully (simulated).'
      });
    } else {
      logger.warn(`Failed to reject access request ${approvalId} via SailPoint.`, { 
        service: 'ApprovalsRoute', 
        approvalId, 
        sailpointStatus: response.status, 
        sailpointResponse: response.data 
      });
      return next(new ApiError(response.status || 500, 'Failed to reject access request via SailPoint.', true, { details: response.data }));
    }
  } catch (error) {
    logger.error(`Error in POST /reject request for ${req.params.approvalId}`, { service: 'ApprovalsRoute', error: error.message, stack: error.stack });
    next(error);
  }
});

module.exports = router;
