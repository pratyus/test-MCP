const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MCP (My Contractor Portal) Server API',
      version: '1.0.0',
      description: 'API for managing SailPoint interactions via an MCP server, including access requests, contractor lifecycle, and user data retrieval.',
      contact: {
        name: 'MCP Development Team',
        url: 'https://example.com/support', // Replace with actual contact/repo URL
        email: 'mcp-dev@example.com',    // Replace with actual contact email
      },
    },
    servers: [
      { 
        url: '/mcp/api/v1', // Using relative path for flexibility with proxies/gateways
        description: 'Current environment server' 
      },
      // Example for local development if different base path or port needed for docs
      // { url: 'http://localhost:3000/mcp/api/v1', description: 'Development server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT Bearer token in the format: Bearer {token}',
        },
      },
      schemas: {
        // --- Authentication Schemas ---
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'contractor1' },
            password: { type: 'string', format: 'password', example: 'password123' },
            userId: { type: 'string', example: 'contractor1-id', description: 'Optional: Can be used instead of username/password for direct login by ID (for simulation/testing).' }
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          },
        },

        // --- Access Request Schemas ---
        AccessRequestItemInput: {
          type: 'object',
          required: ['id', 'type'],
          properties: {
            id: { type: 'string', example: 'accessProfileId123', description: 'ID of the Access Profile, Role, or Entitlement.' },
            type: { type: 'string', enum: ['ACCESS_PROFILE', 'ROLE', 'ENTITLEMENT'], example: 'ACCESS_PROFILE' },
            comment: { type: 'string', example: 'Need for Project Alpha tasks.' },
          },
        },
        AccessRequestInput: {
          type: 'object',
          required: ['requestedFor', 'items'],
          properties: {
            requestedFor: { 
              type: 'array', 
              items: { type: 'string', example: 'sailpoint-id-user1' }, 
              description: 'Array of SailPoint Identity IDs for whom access is being requested.' 
            },
            items: { 
              type: 'array', 
              items: { $ref: '#/components/schemas/AccessRequestItemInput' } 
            },
            justification: { type: 'string', example: 'Overall justification for the request bundle.' },
          },
        },
        AccessRequestResponse: {
          type: 'object',
          properties: {
            requestId: { type: 'string', example: 'sailpointActivityId123', description: 'The ID assigned by SailPoint for tracking the asynchronous request.' },
            status: { type: 'string', example: 'PENDING', description: 'Initial status of the request submission.' },
            message: { type: 'string', example: 'Access request submitted successfully. Status can be tracked.' },
          },
        },
        AccessRequestStatusItem: {
            type: 'object',
            properties: {
                id: { type: 'string', example: 'accessProfileId1' },
                type: { type: 'string', example: 'ACCESS_PROFILE' },
                name: { type: 'string', example: 'Finance Application Access' },
                status: { type: 'string', enum: ['APPROVED', 'REJECTED', 'PENDING_APPROVAL', 'CANCELLED', 'COMPLETED'], example: 'APPROVED' }
            }
        },
        AccessRequestStatusResponse: {
            type: 'object',
            properties: {
                requestId: { type: 'string', example: 'sailpointActivityId123' },
                status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'], example: 'COMPLETED' },
                requestedItems: { type: 'array', items: { $ref: '#/components/schemas/AccessRequestStatusItem' } },
                created: { type: 'string', format: 'date-time', example: '2023-10-27T10:00:00Z' },
                requester: { 
                    type: 'object', 
                    properties: {
                        id: { type: 'string', example: 'userId1' },
                        name: { type: 'string', example: 'Requesting User' }
                    }
                }
            }
        },
        
        // --- Approval Schemas ---
        ApprovalActionInput: {
          type: 'object',
          required: ['comment'],
          properties: {
            comment: { type: 'string', example: 'Approved as per business requirements.' },
          },
        },
        ApprovalItem: {
            type: 'object',
            properties: {
                approvalId: { type: 'string', example: 'approvalId123' },
                request: {
                    type: 'object',
                    properties: {
                        requestId: { type: 'string', example: 'sailpointActivityId456' },
                        requester: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } }, example: { id: 'userId2', name: 'Jane Doe'} },
                        requestedFor: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } }, example: { id: 'userId3', name: 'John Smith'} },
                        item: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string' }, name: { type: 'string' } }, example: { id: 'accessProfileId2', type: 'ACCESS_PROFILE', name: 'Finance System Access'} },
                        dateRequested: { type: 'string', format: 'date-time', example: '2023-10-26T14:30:00Z' }
                    }
                },
                comment: { type: 'string', example: 'Request for finance access' }
            }
        },
        PendingApprovalsResponse: {
            type: 'array',
            items: { $ref: '#/components/schemas/ApprovalItem' }
        },
        ApprovalOutcomeResponse: {
            type: 'object',
            properties: {
                status: { type: 'string', example: 'SUCCESS' },
                message: { type: 'string', example: 'Approval submitted successfully (simulated).' }
            }
        },

        // --- Contractor Lifecycle Schemas ---
        ContractorOnboardInput: {
          type: 'object',
          required: ['firstName', 'lastName', 'email', 'managerSailPointId', 'attributes'],
          properties: {
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            email: { type: 'string', format: 'email', example: 'john.doe.contractor@example.com' },
            managerSailPointId: { type: 'string', example: 'managerIdentityId123', description: 'SailPoint Identity ID of the manager.' },
            startDate: { type: 'string', format: 'date', example: '2024-01-15', description: 'Intended start date.' },
            endDate: { type: 'string', format: 'date', example: '2024-12-31', description: 'Intended end date, for triggering future offboarding or setting access expiration.' },
            attributes: { 
              type: 'object', 
              description: 'Source-specific attributes for account creation.',
              example: { sAMAccountName: 'johndoe-c', department: 'IT-Contractors', employeeId: 'C1001' }
            },
            initialAccess: { 
              type: 'array', 
              items: { type: 'string', example: 'accessProfileIdForContractors' }, 
              description: 'Array of Access Profile or Role IDs for initial provisioning.' 
            },
          },
        },
        ContractorOnboardResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'PENDING' },
            message: { type: 'string', example: 'Contractor onboarding process initiated.' },
            mcpTrackingId: { type: 'string', example: 'mcpOnboardingProcess123' },
            sailpointAccountId: { type: 'string', example: 'sailpointAccountIdIfCreatedImmediately', description: 'SailPoint Account ID if creation is synchronous and ID is available.' },
            sailpointIdentityId: { type: 'string', example: 'sailpointIdentityIdIfAvailable', description: 'SailPoint Identity ID if identity is created/linked and ID is available.' },
          },
        },
        ContractorOffboardInput: {
          type: 'object',
          required: ['contractorSailPointIdentityId'],
          properties: {
            contractorSailPointIdentityId: { type: 'string', example: 'contractorIdentityId456' },
            justification: { type: 'string', example: 'Contract ended.' },
            revokeAllAccess: { type: 'boolean', example: true, description: 'Flag to indicate if all access should be explicitly revoked (actual revocation driven by LCS).' },
          },
        },
        ContractorOffboardResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'PENDING' },
            message: { type: 'string', example: 'Contractor offboarding process initiated.' },
            mcpTrackingId: { type: 'string', example: 'mcpOffboardingProcess456' },
            sailpointTaskActivityId: { type: 'string', example: 'task-lcs-offboard-123', description: 'ID of the SailPoint task for the lifecycle state change.' }
          },
        },

        // --- User Information Schemas ---
        UserAccount: {
            type: 'object',
            properties: {
                accountId: { type: 'string', example: 'sourceAccountId1' },
                sourceName: { type: 'string', example: 'Active Directory' },
                nativeIdentity: { type: 'string', example: 'johndoe' }
            }
        },
        UserManager: {
            type: 'object',
            properties: {
                id: { type: 'string', example: 'managerSailPointId456' },
                displayName: { type: 'string', example: 'Jane Smith' }
            }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'sailpointIdentityId123' },
            displayName: { type: 'string', example: 'John Doe' },
            email: { type: 'string', format: 'email', example: 'john.doe@example.com' },
            lifecycleState: { type: 'string', example: 'active' },
            manager: { $ref: '#/components/schemas/UserManager' },
            accounts: { type: 'array', items: { $ref: '#/components/schemas/UserAccount' } },
          },
        },
        UserEntitlement: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'entitlementIdOrAccessProfileId1' },
            type: { type: 'string', enum: ['ACCESS_PROFILE', 'ROLE', 'ENTITLEMENT'], example: 'ACCESS_PROFILE' },
            name: { type: 'string', example: 'Contractor Base Access' },
            description: { type: 'string', example: 'Basic access for all contractors' },
            source: { type: 'string', example: 'Active Directory', description: 'Source system where the entitlement exists, if applicable.' },
          },
        },
        UserEntitlementsResponse: {
            type: 'array',
            items: { $ref: '#/components/schemas/UserEntitlement' }
        },

        // --- Common Error Schemas ---
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', description: 'A message describing the error.' },
            details: { type: 'object', additionalProperties: true, description: 'Optional additional details or context about the error.' },
            fieldErrors: { 
                type: 'array', 
                items: { 
                    type: 'object', 
                    properties: {
                        field: { type: 'string' },
                        message: { type: 'string' }
                    }
                },
                description: 'Specific field validation errors, if applicable.'
            }
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Unauthorized - JWT token is missing, invalid, or expired.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        Forbidden: {
          description: 'Forbidden - The authenticated user does not have permission to perform this action.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        NotFound: {
          description: 'Resource not found.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        BadRequest: {
          description: 'Bad Request - The request was malformed or missing required parameters.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        UnprocessableEntity: {
            description: 'Unprocessable Entity - Validation error, often with field-specific issues.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
        },
        InternalServerError: {
          description: 'Internal Server Error - An unexpected error occurred on the server.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
      },
    },
    // Apply 'bearerAuth' globally to all paths by default.
    // Specific paths can override this if they don't require authentication (e.g., /login, /health).
    security: [ 
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js'], // Path to the API docs (JSDoc comments in route files)
};

module.exports = options;
