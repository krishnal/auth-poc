import { APIGatewayTokenAuthorizerEvent, Context } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { AuthorizationService } from '../services/authorization-service';

// Mock dependencies
jest.mock('aws-jwt-verify');
jest.mock('google-auth-library');
jest.mock('../services/authorization-service');

const mockEvent: APIGatewayTokenAuthorizerEvent = {
  type: 'TOKEN',
  methodArn: 'arn:aws:execute-api:us-east-1:123456789012:1234567890/test/GET/users',
  authorizationToken: 'Bearer valid-token',
};

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test',
  functionVersion: 'test',
  invokedFunctionArn: 'test',
  memoryLimitInMB: '128',
  awsRequestId: 'test',
  logGroupName: 'test',
  logStreamName: 'test',
  getRemainingTimeInMillis: () => 30000,
  done: jest.fn(),
  fail: jest.fn(),
  succeed: jest.fn(),
};

describe('Lambda Authorizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set environment variables
    process.env.COGNITO_USER_POOL_ID = 'us-east-1_XXXXXXXXX';
    process.env.COGNITO_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';
    process.env.COGNITO_CLIENT_SECRET = 'test-client-secret';
    
    // Reset the module cache to ensure fresh imports
    jest.resetModules();
  });

  it('should allow valid Cognito token', async () => {
    // Mock the entire authorization service module
    jest.doMock('../services/authorization-service', () => ({
      AuthorizationService: jest.fn().mockImplementation(() => ({
        authorizeRequest: jest.fn().mockResolvedValue({
          userId: 'user-123',
          email: 'test@example.com',
          tokenType: 'cognito',
          emailVerified: true,
          username: 'testuser',
          tokenUse: 'access',
        }),
        verifyCognitoToken: jest.fn(),
        verifyGoogleToken: jest.fn(),
        verifyCustomGoogleToken: jest.fn(),
      })),
      AuthorizationError: class extends Error {},
    }));

    // Re-import the handler after mocking
    const { handler } = await import('../handlers/authorizer');
    
    const result = await handler(mockEvent, mockContext);

    expect(result.principalId).toBe('user-123');
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(result.context?.userId).toBe('user-123');
    expect(result.context?.email).toBe('test@example.com');
    expect(result.context?.tokenType).toBe('cognito');
  });

  it('should deny invalid token', async () => {
    // Mock the entire authorization service module
    jest.doMock('../services/authorization-service', () => ({
      AuthorizationService: jest.fn().mockImplementation(() => ({
        authorizeRequest: jest.fn().mockRejectedValue(new Error('Invalid token')),
        verifyCognitoToken: jest.fn(),
        verifyGoogleToken: jest.fn(),
        verifyCustomGoogleToken: jest.fn(),
      })),
      AuthorizationError: class extends Error {},
    }));

    // Re-import the handler after mocking
    const { handler } = await import('../handlers/authorizer');
    
    const result = await handler(mockEvent, mockContext);

    expect(result.principalId).toBe('user');
    expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
  });

  it('should deny missing authorization header', async () => {
    const eventWithoutToken = {
      ...mockEvent,
      authorizationToken: '',
    };

    // Mock the entire authorization service module
    jest.doMock('../services/authorization-service', () => ({
      AuthorizationService: jest.fn().mockImplementation(() => ({
        authorizeRequest: jest.fn().mockRejectedValue(new Error('Missing Authorization header')),
        verifyCognitoToken: jest.fn(),
        verifyGoogleToken: jest.fn(),
        verifyCustomGoogleToken: jest.fn(),
      })),
      AuthorizationError: class extends Error {},
    }));

    // Re-import the handler after mocking
    const { handler } = await import('../handlers/authorizer');
    
    const result = await handler(eventWithoutToken, mockContext);

    expect(result.principalId).toBe('user');
    expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
  });
});