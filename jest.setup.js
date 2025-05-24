// Set environment variables for the test environment
process.env.NODE_ENV = 'test';
process.env.MCP_JWT_SECRET = 'test-super-secret-jwt-key-for-jest';
process.env.LOG_LEVEL = 'silent'; // Suppress logs during tests, or use 'error'/'warn'

// You can also mock global modules here if needed, e.g., a global logger instance
// Or setup any other global state for your tests.

// Example: Mocking console.log to keep test output clean, if desired
// You might want to do this conditionally or use Jest's built-in console mocking/spying.
/*
let originalConsoleLog;
beforeAll(() => {
  originalConsoleLog = console.log;
  console.log = jest.fn(); // Suppress console.log during tests
});

afterAll(() => {
  console.log = originalConsoleLog; // Restore console.log
});
*/
