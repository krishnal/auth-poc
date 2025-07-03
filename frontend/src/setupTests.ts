import '@testing-library/jest-dom';

// Mock environment variables
process.env.REACT_APP_API_BASE_URL = 'http://localhost:3001';
process.env.REACT_APP_AWS_REGION = 'us-east-1';
process.env.REACT_APP_COGNITO_USER_POOL_ID = 'us-east-1_XXXXXXXXX';
process.env.REACT_APP_COGNITO_CLIENT_ID = 'test-client-id';
process.env.REACT_APP_GOOGLE_CLIENT_ID = 'test-google-client-id';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

// Mock window.location
delete (window as any).location;
window.location = { href: '', origin: 'http://localhost:3000' } as any;