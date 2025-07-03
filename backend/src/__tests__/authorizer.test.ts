import { APIGatewayTokenAuthorizerEvent, Context } from 'aws-lambda';
import { handler } from '../handlers/authorizer';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

// Mock dependencies
jest.mock('aws-jwt-verify');
jest.mock('google-auth-library');

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
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
  });

  it('should allow valid Cognito token', async () => {
    const mockVerifier = {
      verify: jest.fn().mockResolvedValue({
        sub: 'user-123',
        email: 'test@example.com',
        'cognito:username': 'testuser',
        token_use: 'access',
        email_verified: true,
      }),
    };

    (CognitoJwtVerifier.create as jest.Mock).mockReturnValue(mockVerifier);

    const result = await handler(mockEvent, mockContext);

    expect(result.principalId).toBe('user-123');
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
    expect(result.context?.userId).toBe('user-123');
    expect(result.context?.email).toBe('test@example.com');
    expect(result.context?.tokenType).toBe('cognito');
  });

  it('should deny invalid token', async () => {
    const mockVerifier = {
      verify: jest.fn().mockRejectedValue(new Error('Invalid token')),
    };

    (CognitoJwtVerifier.create as jest.Mock).mockReturnValue(mockVerifier);

    const result = await handler(mockEvent, mockContext);

    expect(result.principalId).toBe('user');
    expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
  });

  it('should deny missing authorization header', async () => {
    const eventWithoutToken = {
      ...mockEvent,
      authorizationToken: '',
    };

    const result = await handler(eventWithoutToken, mockContext);

    expect(result.principalId).toBe('user');
    expect(result.policyDocument.Statement[0].Effect).toBe('Deny');
  });
});