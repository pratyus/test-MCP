const express = require('express');
require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 3000;

// Import core utilities and middleware
const logger = require('./utils/logger');
const requestLoggerMiddleware = require('./middleware/requestLoggerMiddleware');
const errorHandlerMiddleware = require('./middleware/errorHandlerMiddleware');
const authenticateToken = require('./middleware/authMiddleware');

// Swagger/OpenAPI
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerOptions = require('../swaggerOptions'); // Adjust path if necessary

// Import route handlers
const authRouter = require('./routes/auth');
const accessRequestsRouter = require('./routes/accessRequests');
const approvalsRouter = require('./routes/approvals');
const contractorLifecycleRouter = require('./routes/contractors');
const userInfoRouter = require('./routes/users');

// Middleware to parse JSON bodies
app.use(express.json());

// Apply request logging middleware (should be one of the first)
app.use(requestLoggerMiddleware);

// --- Public Routes ---
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'MCP Server is running' });
});

// --- API Documentation Route (Public) ---
try {
  const openapiSpecification = swaggerJsdoc(swaggerOptions);
  app.use('/mcp/api/v1/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpecification));
  logger.info('Swagger UI setup at /mcp/api/v1/api-docs', { service: 'SwaggerDocs' });
} catch (error) {
  logger.error('Failed to initialize Swagger JSDoc or UI', { service: 'SwaggerDocs', error: error.message, stack: error.stack });
}


// --- Public API Routes ---
// Auth routes (e.g., login) - typically public or has its own auth logic
app.use('/mcp/api/v1/auth', authRouter);


// --- Protected API Routes ---
// Apply authentication middleware to all routes below this point
app.use('/mcp/api/v1/requests', authenticateToken, accessRequestsRouter);
app.use('/mcp/api/v1/approvals', authenticateToken, approvalsRouter);
app.use('/mcp/api/v1/contractors', authenticateToken, contractorLifecycleRouter);
app.use('/mcp/api/v1/users', authenticateToken, userInfoRouter);


// Apply Centralized Error Handling Middleware (should be the last one)
app.use(errorHandlerMiddleware);


// Start the server
if (process.env.NODE_ENV !== 'test') { // Avoid starting server during tests if not needed
  app.listen(PORT, () => {
    logger.info(`MCP Server listening on port ${PORT}`, { service: 'ApplicationStart' });
  });
}

module.exports = app; // Export for potential testing or programmatic use
