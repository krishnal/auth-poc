// backend/src/handlers/authorizer.ts
import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult, Context } from 'aws-lambda';
import { AuthorizationService, AuthorizationError } from '../services/authorization-service';
import { getEnvironmentContext } from '../utils/environment';
import { Logger } from '../utils/logger';

// Export the functions for backward compatibility and reuse
const authorizationService = new AuthorizationService();

export const verifyCognitoToken = authorizationService.verifyCognitoToken.bind(authorizationService);
// Google token verification methods removed - now using Cognito federation

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
  const environmentContext = getEnvironmentContext(event);
  const logger = new Logger({ 
    service: 'Authorizer',
    requestId: context.awsRequestId 
  });

  logger.info('Authorizer invoked', { 
    methodArn: event.methodArn,
    environment: environmentContext.isAWS ? 'aws' : 'local',
  });

  try {
    // Use the authorization service to verify token and get auth context
    const authContext = await authorizationService.authorizeRequest(event.authorizationToken);

    logger.info('Authorization successful', {
      userId: authContext.userId,
      email: authContext.email,
      tokenType: authContext.tokenType,
    });

    // Convert AuthContext to string values for API Gateway
    // All tokens are now Cognito tokens (including federated Google users)
    const stringAuthContext = {
      userId: String(authContext.userId),
      email: String(authContext.email),
      tokenType: String(authContext.tokenType),
      emailVerified: String(authContext.emailVerified),
      username: String(authContext.username || authContext.userId),
      tokenUse: String(authContext.tokenUse || ''),
      // Additional attributes for federated users
      name: String(authContext.name || ''),
      givenName: String(authContext.givenName || ''),
      familyName: String(authContext.familyName || ''),
      picture: String(authContext.picture || ''),
    };

    return generatePolicy(authContext.userId, 'Allow', event.methodArn, stringAuthContext);

  } catch (error) {
    logger.error('Authorization failed', error);

    if (error instanceof AuthorizationError) {
      logger.warn('Known authorization error', { 
        error: error.message,
        statusCode: error.statusCode 
      });
      return generatePolicy('user', 'Deny', event.methodArn);
    }

    // For unexpected errors, also deny but log for investigation
    logger.error('Unexpected authorization error', error);
    return generatePolicy('user', 'Deny', event.methodArn);
  }
};
