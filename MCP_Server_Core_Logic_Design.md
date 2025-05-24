## MCP Server Core Logic Design

### 1. API Endpoint Definitions

The MCP (My Contractor Portal) server will expose the following RESTful API endpoints. All request and response bodies will be in JSON format.

Authentication with the MCP server itself is not covered in this design but would typically involve a token-based mechanism (e.g., JWT) for its own endpoints.

---

#### 1.1. Access Requests

*   **Endpoint:** `POST /mcp/api/v1/requests`
    *   **HTTP Method:** `POST`
    *   **Description:** Submits an access request for one or more entitlements/access profiles on behalf of the authenticated user or specified users.
    *   **Request Body:**
        ```json
        {
          "requestedFor": ["userId1", "userId2"], // Array of SailPoint Identity IDs. If for self, can be derived from auth token.
          "items": [ // Items being requested
            {
              "id": "accessProfileId1",
              "type": "ACCESS_PROFILE", // Or "ENTITLEMENT", "ROLE"
              "comment": "Need for Project Alpha"
            }
          ],
          "justification": "User requires access to complete Project Alpha tasks."
        }
        ```
    *   **Response Body (Success - 202 Accepted):**
        ```json
        {
          "requestId": "sailpointActivityId123",
          "status": "PENDING",
          "message": "Access request submitted successfully. Status can be tracked."
        }
        ```
    *   **Response Body (Error - 4xx/5xx):**
        ```json
        {
          "error": "Error message detailing the issue"
        }
        ```

*   **Endpoint:** `GET /mcp/api/v1/requests/status/{sailpointActivityId}`
    *   **HTTP Method:** `GET`
    *   **Description:** Retrieves the status of a previously submitted access request.
    *   **Request Body:** None
    *   **Response Body (Success - 200 OK):**
        ```json
        {
          "requestId": "sailpointActivityId123",
          "status": "COMPLETED", // Or PENDING, FAILED, etc.
          "requestedItems": [
            {
              "id": "accessProfileId1",
              "type": "ACCESS_PROFILE",
              "status": "APPROVED" // Or REJECTED, PENDING_APPROVAL
            }
          ],
          "created": "2023-10-27T10:00:00Z",
          "requester": { "id": "userId1", "name": "Requesting User" }
        }
        ```

---

#### 1.2. Access Request Approvals

*   **Endpoint:** `GET /mcp/api/v1/approvals/pending`
    *   **HTTP Method:** `GET`
    *   **Description:** Retrieves a list of pending access request approvals for the authenticated user (who is an approver).
    *   **Request Body:** None
    *   **Response Body (Success - 200 OK):**
        ```json
        [
          {
            "approvalId": "approvalId123",
            "request": {
              "requestId": "sailpointActivityId456",
              "requester": { "id": "userId2", "name": "Jane Doe" },
              "requestedFor": { "id": "userId3", "name": "John Smith" },
              "item": { "id": "accessProfileId2", "type": "ACCESS_PROFILE", "name": "Finance System Access" },
              "dateRequested": "2023-10-26T14:30:00Z"
            },
            "comment": "Request for finance access"
          }
        ]
        ```

*   **Endpoint:** `POST /mcp/api/v1/approvals/{approvalId}/approve`
    *   **HTTP Method:** `POST`
    *   **Description:** Approves a pending access request.
    *   **Request Body:**
        ```json
        {
          "comment": "Approved as per manager confirmation."
        }
        ```
    *   **Response Body (Success - 200 OK):**
        ```json
        {
          "status": "SUCCESS",
          "message": "Approval submitted successfully."
        }
        ```

*   **Endpoint:** `POST /mcp/api/v1/approvals/{approvalId}/reject`
    *   **HTTP Method:** `POST`
    *   **Description:** Rejects a pending access request.
    *   **Request Body:**
        ```json
        {
          "comment": "Access not required for current role."
        }
        ```
    *   **Response Body (Success - 200 OK):**
        ```json
        {
          "status": "SUCCESS",
          "message": "Rejection submitted successfully."
        }
        ```

---

#### 1.3. Contractor Lifecycle Management

*   **Endpoint:** `POST /mcp/api/v1/contractors/onboard`
    *   **HTTP Method:** `POST`
    *   **Description:** Onboards a new contractor. This involves creating a user account in a designated source and assigning initial entitlements/access profiles.
    *   **Request Body:**
        ```json
        {
          "firstName": "John",
          "lastName": "Doe",
          "email": "john.doe.contractor@example.com",
          "managerSailPointId": "managerIdentityId123",
          "startDate": "YYYY-MM-DD", // For record keeping, SailPoint handles this via lifecycle states
          "endDate": "YYYY-MM-DD",   // For triggering future offboarding or setting access expiration
          "attributes": { // Source-specific attributes
            "sAMAccountName": "johndoe-c",
            "department": "IT-Contractors"
            // ... other necessary attributes for the target source
          },
          "initialAccess": [ // Array of Access Profile or Role IDs
            "accessProfileIdForContractors",
            "roleIdForBasicAccess"
          ]
        }
        ```
    *   **Response Body (Success - 202 Accepted):**
        ```json
        {
          "status": "PENDING",
          "message": "Contractor onboarding process initiated.",
          "trackingId": "mcpOnboardingProcess123", // MCP's internal tracking ID
          "sailpointAccountId": "sailpointAccountIdIfCreatedImmediately", // Optional, if account creation is synchronous and ID is available
          "sailpointIdentityId": "sailpointIdentityIdIfAvailable" // Optional, if identity is created/linked and ID is available
        }
        ```

*   **Endpoint:** `POST /mcp/api/v1/contractors/offboard`
    *   **HTTP Method:** `POST`
    *   **Description:** Offboards a contractor. This typically involves disabling the user's account(s) and potentially revoking all access.
    *   **Request Body:**
        ```json
        {
          "contractorSailPointIdentityId": "contractorIdentityId456",
          "justification": "Contract ended.",
          "revokeAllAccess": true // Flag to indicate if all access should be explicitly revoked
        }
        ```
    *   **Response Body (Success - 202 Accepted):**
        ```json
        {
          "status": "PENDING",
          "message": "Contractor offboarding process initiated.",
          "trackingId": "mcpOffboardingProcess456"
        }
        ```

---

#### 1.4. User Information

*   **Endpoint:** `GET /mcp/api/v1/users/{sailpointIdentityId}`
    *   **HTTP Method:** `GET`
    *   **Description:** Retrieves basic details for a specific user (identity).
    *   **Request Body:** None
    *   **Response Body (Success - 200 OK):**
        ```json
        {
          "id": "sailpointIdentityId123",
          "displayName": "John Doe",
          "email": "john.doe@example.com",
          "lifecycleState": "active", // Or "terminated", etc.
          "manager": {
            "id": "managerSailPointId456",
            "displayName": "Jane Smith"
          },
          "accounts": [ // Simplified list of associated source accounts
            {
              "accountId": "sourceAccountId1",
              "sourceName": "Active Directory",
              "nativeIdentity": "johndoe"
            }
          ]
        }
        ```

*   **Endpoint:** `GET /mcp/api/v1/users/{sailpointIdentityId}/entitlements`
    *   **HTTP Method:** `GET`
    *   **Description:** Retrieves a list of entitlements (or access profiles/roles for simplicity) held by a specific user.
    *   **Request Body:** None
    *   **Response Body (Success - 200 OK):**
        ```json
        [
          {
            "id": "entitlementIdOrAccessProfileId1",
            "type": "ACCESS_PROFILE", // Or "ENTITLEMENT", "ROLE"
            "name": "Contractor Base Access",
            "description": "Basic access for all contractors",
            "source": "Active Directory" // If applicable
          },
          {
            "id": "entitlementId2",
            "type": "ENTITLEMENT",
            "name": "Project Alpha Share - Read",
            "description": "Read access to Project Alpha network share",
            "source": "File Server"
          }
        ]
        ```

---

### 2. Data Models (Internal to MCP Server)

These are simplified models for internal use within the MCP server.

*   **`UserRequest`**
    ```typescript
    interface UserRequest {
      id?: string; // MCP's internal ID
      sailpointActivityId?: string; // ID returned by SailPoint for tracking
      requesterSailpointId: string;
      requestedForSailpointIds: string[];
      items: Array<{
        sailpointItemId: string;
        type: "ACCESS_PROFILE" | "ENTITLEMENT" | "ROLE";
        comment?: string;
      }>;
      justification?: string;
      status: "PENDING_SUBMISSION" | "PENDING_SAILPOINT_COMPLETION" | "COMPLETED" | "FAILED";
      mcpCreatedAt: Date;
      sailpointResponse?: any; // Store raw response from SailPoint for diagnostics
    }
    ```

*   **`User` (Simplified for MCP context)**
    ```typescript
    interface User {
      sailpointIdentityId: string;
      displayName?: string;
      email?: string;
      managerSailpointId?: string;
      managerDisplayName?: string;
      lifecycleState?: string; // From SailPoint Identity
      // Potentially a simplified list of accounts if frequently needed by MCP
      linkedAccounts?: Array<{
        sailpointAccountId: string;
        sourceName: string;
        nativeIdentity: string; // Username on the source
      }>;
    }
    ```

*   **`Entitlement` (Simplified for MCP context)**
    ```typescript
    interface Entitlement {
      sailpointId: string; // ID of the entitlement, access profile, or role in SailPoint
      type: "ACCESS_PROFILE" | "ENTITLEMENT" | "ROLE";
      name: string;
      description?: string;
      sourceName?: string; // Source system where the entitlement exists
    }
    ```

---

### 3. Interaction Flows with SailPoint V3 API

#### Common Steps:

*   **Authentication:** Before any call to SailPoint, the MCP server must obtain a Bearer token using the Client Credentials flow with its configured PAT (Client ID & Secret).
    *   `POST https://[tenant].api.identitynow.com/oauth/token`
    *   This token will be included in the `Authorization` header for subsequent SailPoint API calls.
    *   The MCP server should manage the lifecycle of this token (e.g., cache and refresh if necessary, though PAT-generated tokens are typically long-lived but should be handled as per SailPoint's guidance on expiration).

---

#### 3.1. `POST /mcp/api/v1/requests` (User Access Request Submission)

1.  **MCP Server:** Receives the request.
2.  **MCP Server:** Constructs the payload for SailPoint's `create-access-request` API.
    *   The `requestedFor` array in the MCP request (containing SailPoint Identity IDs) maps to `requestedFor` in the SailPoint API.
    *   The `items` array maps to `requestedItems`. MCP needs to ensure `id` and `type` are correctly translated.
3.  **MCP Server:** Calls SailPoint: `POST /v3/access-requests`
    *   **Request Body (to SailPoint):**
        ```json
        {
          "requestedFor": ["userId1", "userId2"], // SailPoint Identity IDs
          "requestType": "GRANT_ACCESS", // Assuming MCP primarily handles grant requests via this endpoint
          "requestedItems": [
            {
              "id": "accessProfileId1",
              "type": "ACCESS_PROFILE", // Or ENTITLEMENT, ROLE
              "comment": "Need for Project Alpha"
            }
          ]
          // SailPoint API might not have a direct "justification" field at the top level of access-requests;
          // comments are usually per item. MCP might log the overall justification internally.
        }
        ```
4.  **SailPoint:** Processes the request asynchronously and returns a `202 Accepted` with an activity ID (e.g., `taskId` or similar in the response body, often in a format like `{ "id": "activityId", "type": "TASK_RESULT" }` or directly a task ID).
5.  **MCP Server:** Stores the SailPoint activity ID, links it to its internal request record, and returns the response to the MCP client.

---

#### 3.2. `GET /mcp/api/v1/requests/status/{sailpointActivityId}`

1.  **MCP Server:** Receives the request with `sailpointActivityId`.
2.  **MCP Server:** Calls SailPoint: `GET /v3/access-request-status?taskId={sailpointActivityId}` (or the equivalent endpoint if the ID corresponds to a different status tracking mechanism identified from the `/access-requests` response).
    *   *Correction based on earlier exploration: The `list-access-request-status` endpoint might require filtering by `id` or a similar query parameter if the `sailpointActivityId` is the direct ID of the request itself, or it might be a task ID from an asynchronous submission.*
    *   Let's assume `sailpointActivityId` is the `id` of the access request item.
    *   `GET /v3/access-request-status?filters=id eq "{sailpointActivityId}"` (This needs verification against actual SailPoint response for `/access-requests`).
    *   Alternatively, if the ID is a task ID for the whole submission: `GET /v3/task-status/{sailpointActivityId}` (if SailPoint uses a general task status endpoint for async operations). The access request specific status endpoint (`/v3/access-request-status`) is more likely.
3.  **SailPoint:** Returns the status details.
4.  **MCP Server:** Transforms the SailPoint response into the MCP's defined response format and sends it to the client.

---

#### 3.3. `GET /mcp/api/v1/approvals/pending`

1.  **MCP Server:** Receives the request. The authenticated MCP user's SailPoint Identity ID needs to be determined (e.g., from MCP's session/token).
2.  **MCP Server:** Calls SailPoint: `GET /v3/access-request-approvals/pending`
    *   This endpoint, by default, returns pending approvals for the user associated with the SailPoint API token. If MCP uses a service account token, it might need to use query parameters like `ownerId` or similar if the API supports fetching approvals *for* a specific user by an admin token. Assuming the call is made in the context of the approver.
3.  **SailPoint:** Returns a list of pending approval items.
4.  **MCP Server:** Transforms the data into the MCP format (e.g., extracting item details, requester info) and sends it to the client.

---

#### 3.4. `POST /mcp/api/v1/approvals/{approvalId}/approve`

1.  **MCP Server:** Receives the request with `approvalId` and `comment`.
2.  **MCP Server:** Calls SailPoint: `POST /v3/access-request-approvals/{approvalId}/approve`
    *   **Request Body (to SailPoint):**
        ```json
        {
          "comment": "Approved as per manager confirmation."
        }
        ```
3.  **SailPoint:** Processes the approval and returns a success/failure response.
4.  **MCP Server:** Returns the outcome to the MCP client.

---

#### 3.5. `POST /mcp/api/v1/approvals/{approvalId}/reject`

1.  **MCP Server:** Receives the request with `approvalId` and `comment`.
2.  **MCP Server:** Calls SailPoint: `POST /v3/access-request-approvals/{approvalId}/reject`
    *   **Request Body (to SailPoint):**
        ```json
        {
          "comment": "Access not required for current role."
        }
        ```
3.  **SailPoint:** Processes the rejection and returns a success/failure response.
4.  **MCP Server:** Returns the outcome to the MCP client.

---

#### 3.6. `POST /mcp/api/v1/contractors/onboard` (Complex Flow)

This is a multi-step process.

1.  **MCP Server:** Receives onboarding data.
2.  **(Pre-check/Optional):** MCP Server might query SailPoint for an existing identity if email or other attributes might already exist to avoid duplicates, or if the contractor is a rehire.
    *   `GET /v3/public-identities?filters=email eq "john.doe.contractor@example.com"` or more comprehensively using `POST /v3/search` with appropriate query.
3.  **MCP Server:** Creates the user account on the designated authoritative source (e.g., a specific HR source for contractors, or directly in an AD instance if configured as such).
    *   Calls SailPoint: `POST /v3/accounts`
    *   **Request Body (to SailPoint):**
        ```json
        {
          "sourceId": "sailpointSourceIdForContractors", // Configured in MCP
          // "identityId": null, // Let SailPoint create a new identity or correlate later
          "attributes": {
            "sAMAccountName": "johndoe-c", // from MCP request
            "mail": "john.doe.contractor@example.com",
            "displayName": "John Doe",
            // ... other attributes from MCP request, mapped to source schema
            // Potentially set manager info here if the source schema supports it directly
          },
          "entitlements": false // Usually, entitlements are managed via access profiles/roles post-creation
        }
        ```
    *   SailPoint will create the account on the source. This is an asynchronous operation. MCP receives a task ID.
4.  **MCP Server:** Monitors the account creation task status using `GET /v3/task-status/{task_id_from_account_creation}`.
5.  **Once Account is Created and Aggregated into an Identity:**
    *   SailPoint processes the new account, and an Identity should be created/updated and correlated based on the Identity Profile for that source. This might involve a delay for aggregation and identity processing.
    *   MCP needs the new SailPoint Identity ID. This might be retrieved by searching for the identity based on known attributes (e.g., accountId from step 3, or email) after a reasonable delay.
        *   `GET /v3/accounts?filters=id eq "{accountIdFromStep3}"` (to get its identityId if populated)
        *   Or `POST /v3/search` (e.g., `searchableObjectsV3?query=attributes.email:"john.doe.contractor@example.com" AND identityProfile.name:"Contractor Profile"`)
6.  **MCP Server (Assign Initial Access):** Once the SailPoint Identity ID is known (`newContractorIdentityId`).
    *   For each item in `initialAccess` from the MCP request:
        *   Calls SailPoint: `POST /v3/access-requests`
        *   **Request Body (to SailPoint):**
            ```json
            {
              "requestedFor": ["newContractorIdentityId"],
              "requestType": "GRANT_ACCESS",
              "requestedItems": [
                { "id": "accessProfileIdForContractors", "type": "ACCESS_PROFILE" }
              ]
            }
            ```
    *   This will trigger SailPoint's provisioning and approval workflows (if any) for the initial set of access.
7.  **MCP Server:** Optionally, if `endDate` is provided, it might schedule an internal task to trigger offboarding, or if SailPoint supports setting an "access end date" on the identity or specific access items, it would make those calls.
    *   Lifecycle States in SailPoint are the more robust way to handle time-based de-provisioning. MCP might trigger a lifecycle state change if the `endDate` implies moving to a "pre-termination" or similar state.
    *   `POST /v3/identities/{identityId}/set-lifecycle-state` (This is a hypothetical endpoint structure, actual might be via `PATCH` to identity attributes or a dedicated lifecycle API if available in V3 - The `Identity Profiles` API had `sync-identity-profile` which processes identities, and lifecycle states are part of the identity profile definition. Direct setting of a state on an identity might be via patching its `lifecycleState` attribute if exposed or a specific command). *The `Lifecycle States` API (link 61 on initial page) would be relevant here.*
8.  **MCP Server:** Responds to the MCP client, possibly with a tracking ID for the overall onboarding process.

---

#### 3.7. `POST /mcp/api/v1/contractors/offboard`

1.  **MCP Server:** Receives the request with `contractorSailPointIdentityId`.
2.  **MCP Server (Option 1: Disable Accounts):**
    *   First, find all accounts associated with the `contractorSailPointIdentityId`.
        *   `GET /v3/accounts?filters=identityId eq "{contractorSailPointIdentityId}"`
    *   For each account found:
        *   Calls SailPoint: `POST /v3/accounts/{accountId}/disable`
        *   Monitor task status for each disable operation.
3.  **MCP Server (Option 2: Trigger Lifecycle State for Offboarding):**
    *   This is generally the preferred method in SailPoint.
    *   Determine the appropriate "terminated" or "offboarded" lifecycle state ID from the relevant Identity Profile.
    *   Calls SailPoint to change the identity's lifecycle state. This could be via:
        *   `PATCH /v3/identities/{contractorSailPointIdentityId}` with a payload to update the `lifecycleState` attribute (if the Identities API allows direct PATCH of this attribute, which is common).
        *   Or, if a specific API for lifecycle state changes exists under `/v3/lifecycle-states` or `/v3/identities`. (The `Lifecycle States` API (link 61 from original V3 list) would be consulted here - it had `list`, `get`, `create`, `update`, `delete` for lifecycle states *themselves*, not directly applying them to users. Applying them is usually part of identity processing or direct identity update).
    *   SailPoint's configured workflows for that lifecycle state change would then handle disabling accounts, revoking access, etc.
4.  **MCP Server (Option 3: If `revokeAllAccess` is true and direct revocation is desired):**
    *   This is less ideal than lifecycle states but provides direct control if needed.
    *   List all current access for the identity (roles, access profiles). This can be complex and may involve searching access items associated with the user.
        *   `GET /v3/searchable-objects?indices=accessprofiles,roles&query=identity.id:{contractorSailPointIdentityId}` (hypothetical search query) or by listing their accounts and then entitlements for each.
    *   For each access item:
        *   Calls SailPoint: `POST /v3/access-requests`
        *   **Request Body (to SailPoint):**
            ```json
            {
              "requestedFor": ["contractorSailPointIdentityId"],
              "requestType": "REVOKE_ACCESS",
              "requestedItems": [
                { "id": "itemIdToRevoke", "type": "ACCESS_PROFILE" } // Or ROLE, ENTITLEMENT
              ]
              // Potentially add 'removeDate' if immediate.
            }
            ```
5.  **MCP Server:** Responds to the MCP client.

---

#### 3.8. `GET /mcp/api/v1/users/{sailpointIdentityId}`

1.  **MCP Server:** Receives request.
2.  **MCP Server:** Calls SailPoint's Search API or a dedicated Identities API if a more direct one exists for fetching a single identity's details. The "Public Identities" API (`GET /v3/public-identities?filters=id eq "{sailpointIdentityId}"`) is one option, but might be limited in attributes. A more comprehensive way would be:
    *   `POST /v3/search` with a query for the specific identity ID.
    *   Example Search Query:
        ```json
        {
          "query": {
            "query": "id:\"{sailpointIdentityId}\""
          },
          "indices": ["identities"],
          "includeNested": true // To get manager info, accounts, etc.
        }
        ```
3.  **SailPoint:** Returns identity data.
4.  **MCP Server:** Transforms the detailed SailPoint identity object into the simplified MCP `User` model. This will involve extracting `displayName`, `email`, `lifecycleState`, manager's basic info, and a list of correlated accounts.
5.  **MCP Server:** Responds to the MCP client.

---

#### 3.9. `GET /mcp/api/v1/users/{sailpointIdentityId}/entitlements`

1.  **MCP Server:** Receives request.
2.  **MCP Server:** This is a complex query in SailPoint as entitlements are diverse. The most straightforward way to represent "what a user has" is often through their Access Profiles and Roles.
    *   **Option A (Access Profiles & Roles):**
        1.  Use SailPoint Search API: `POST /v3/search`
            *   Query for Access Profiles assigned to the user:
                ```json
                {
                  "query": { "query": "access.id:\"{sailpointIdentityId}\" AND access.type:\"IDENTITY\"" }, // This query syntax needs checking for owned items
                  "indices": ["accessprofiles"], // And "roles"
                  // It's more likely you search for identities and expand their access:
                  // { "query": { "query": "id:\"{sailpointIdentityId}\"" }, "indices": ["identities"], "queryDslVersion": "v2", "_includeOptimized": "access" }
                  // Or more direct:
                  // GET /beta/identities/{sailpointIdentityId}/access-items (Beta endpoint, but shows capability)
                  // V3 might have something similar or require search.
                }
                ```
            *   The `Search` API (`/v3/search`) is the most flexible for this. The query would need to fetch access profiles/roles associated with the identity.
    *   **Option B (Direct Entitlements per Account):**
        1.  First, get all accounts for the identity: `GET /v3/accounts?filters=identityId eq "{sailpointIdentityId}"`
        2.  For each `accountId` returned:
            *   Call `GET /v3/accounts/{accountId}/entitlements`
        3.  Aggregate these results.
3.  **SailPoint:** Returns the data.
4.  **MCP Server:** Transforms the SailPoint response into the MCP's `Entitlement` model list. This might involve listing the Access Profiles/Roles directly or summarizing fine-grained entitlements.
5.  **MCP Server:** Responds to the MCP client.

---
