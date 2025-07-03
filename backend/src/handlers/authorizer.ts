// backend/src/handlers/authorizer.ts
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables for local development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, Context } from 'aws-lambda';
import { AuthorizationService, AuthorizationError } from '../services/authorization-service';

// Export the functions for backward compatibility and reuse
const authorizationService = new AuthorizationService();

export const verifyCognitoToken = authorizationService.verifyCognitoToken.bind(authorizationService);
export const verifyGoogleToken = authorizationService.verifyGoogleToken.bind(authorizationService);
export const verifyCustomGoogleToken = authorizationService.verifyCustomGoogleToken.bind(authorizationService);

const generatePolicy = (
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, any>
): APIGatewayAuthorizerResult => {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context: context || {},
  };
};

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent,
  context: Context
): Promise<APIGatewayAuthorizerResult> => {
  console.log('Authorizer invoked', { 
    requestId: context.awsRequestId,
    methodArn: event.methodArn 
  });

  try {
    // Use the authorization service to verify token and get auth context
    const authContext = await authorizationService.authorizeRequest(event.authorizationToken);

    console.log('Authorization successful', {
      userId: authContext.userId,
      email: authContext.email,
      tokenType: authContext.tokenType,
      contextKeys: Object.keys(authContext),
    });

    // Convert AuthContext to string values for API Gateway
    const stringAuthContext = {
      userId: String(authContext.userId),
      email: String(authContext.email),
      tokenType: String(authContext.tokenType),
      emailVerified: String(authContext.emailVerified),
      ...(authContext.tokenType === 'cognito' && {
        username: String(authContext.username || authContext.userId),
        tokenUse: String(authContext.tokenUse || ''),
      }),
      ...(authContext.tokenType === 'google' && {
        name: String(authContext.name || ''),
        givenName: String(authContext.givenName || ''),
        familyName: String(authContext.familyName || ''),
        picture: String(authContext.picture || ''),
      }),
    };

    return generatePolicy(authContext.userId, 'Allow', event.methodArn, stringAuthContext);

  } catch (error) {
    console.error('Authorization failed:', error);

    if (error instanceof AuthorizationError) {
      // For known errors, return Deny policy
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    // For unexpected errors, also deny but log for investigation
    console.error('Unexpected authorization error:', error);
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};
