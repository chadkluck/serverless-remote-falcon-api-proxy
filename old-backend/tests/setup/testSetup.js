/**
 * Backend Test Setup Configuration
 * 
 * This file configures Jest for backend testing with proper isolation
 * from frontend components. All frontend interactions should use mock events.
 */

// Node.js polyfills for testing environment
const { TextEncoder, TextDecoder } = require('util');

// Polyfills for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Setup before each test
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset modules to ensure clean state
  jest.resetModules();
  
  // Mock console methods to reduce noise in tests
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

// Cleanup after each test
afterEach(() => {
  // Restore all mocks after each test
  jest.restoreAllMocks();
});

// Configure test timeout
jest.setTimeout(10000);

// Global test configuration
global.testConfig = {
  mockEvents: {
    frontendRequestsPath: './mock-events/frontend-requests',
    lambdaEventsPath: './mock-events/lambda-events'
  },
  testEnvironment: 'node',
  isolation: {
    enforceNoFrontendImports: true,
    requireMockEvents: true
  }
};

// Mock AWS SDK clients for testing
jest.mock('@aws-sdk/client-ssm', () => ({
  SSMClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  GetParameterCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  InvokeCommand: jest.fn()
}));

// Mock jose library for testing (ES module compatibility)
jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader: jest.fn().mockReturnThis(),
    setIssuedAt: jest.fn().mockReturnThis(),
    setExpirationTime: jest.fn().mockReturnThis(),
    sign: jest.fn().mockResolvedValue('mock-jwt-token')
  }))
}));

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';

// Global error handler for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Extend Jest matchers for better assertions
expect.extend({
  toBeValidLambdaResponse(received) {
    const pass = received && 
                 typeof received.statusCode === 'number' &&
                 received.statusCode >= 100 && received.statusCode < 600 &&
                 typeof received.body === 'string' &&
                 typeof received.headers === 'object';
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid Lambda response`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid Lambda response with statusCode, body, and headers`,
        pass: false,
      };
    }
  },
});