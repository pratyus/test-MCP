module.exports = {
  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",

  // An array of glob patterns indicating a set of files for which coverage information should be collected
  // collectCoverageFrom: ['src/**/*.{js,jsx}'],

  // The test environment that will be used for testing
  testEnvironment: "node",

  // Setup to run before all tests, e.g., to set environment variables
  setupFilesAfterEnv: ["./jest.setup.js"], // We'll create this file next

  // Module file extensions for Jest to look for
  moduleFileExtensions: ["js", "json", "jsx", "node"],

  // A map from regular expressions to module names or to arrays of module names that allow to stub out resources with a single module
  // moduleNameMapper: {},

  // The glob patterns Jest uses to detect test files
  testMatch: [
    "**/__tests__/**/*.js?(x)",
    "**/?(*.)+(spec|test).js?(x)"
  ],

  // A map from regular expressions to paths to transformers
  // transform: {},

  // Indicates whether each individual test should be reported during the run
  verbose: true,
};
