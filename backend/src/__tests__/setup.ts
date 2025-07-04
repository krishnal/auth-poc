import { jest } from '@jest/globals';

// Mock environment variables for testing
process.env.AWS_REGION = 'us-east-1';
process.env.COGNITO_USER_POOL_ID = 'us-east-1_XXXXXXXXX';
process.env.COGNITO_CLIENT_ID = 'test-client-id';
process.env.COGNITO_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';

// Reset configuration after each test
afterEach(() => {
  const { resetConfig } = require('../config');
  resetConfig();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};