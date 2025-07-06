import { FastifyInstance } from 'fastify';
import { AuthorizationService, AuthContext } from '../services/authorization-service';
import { 
  getEnvironmentContext, 
  extractLambdaEvent, 
  extractAWSEventContext 
} from '../utils/environment';
import { Logger } from '../utils/logger';

// Store the current Lambda event globally for AWS environment
let currentLambdaEvent: any = null;

/**
 * Sets the current Lambda event for AWS environment processing
 */
export function setLambdaEvent(event: any): void {
  currentLambdaEvent = event;
}

/**
 * Clears the current Lambda event
 */
export function clearLambdaEvent(): void {
  currentLambdaEvent = null;
}

/**
 * Registers authentication middleware with the Fastify app
 */
export function registerAuth(app: FastifyInstance, environment?: string): void {
  // Initialize authorization service
  const authorizationService = new AuthorizationService();

  // Authentication middleware
  app.addHook('preHandler', async (request: any) => {
    const logger = new Logger({ service: 'AuthMiddleware' });
    
    // Extract Lambda event using the environment utility
    const event = extractLambdaEvent(request, currentLambdaEvent);
    const environmentContext = getEnvironmentContext(event);
    const awsContext = extractAWSEventContext(event);
    
    logger.info('Processing request', {
      url: request.url,
      method: request.method,
      environment: environment || 'unknown',
      isAWS: environmentContext.isAWS,
      hasAuthorizer: awsContext?.hasAuthorizer || false,
    });
    
    if (environmentContext.isAWS && awsContext) {
      // AWS Environment: Extract auth context from Lambda authorizer
      logger.info('Processing AWS environment request');
      
      let authContext: AuthContext | null = null;
      
      // Try to get from requestContext.authorizer first
      if (awsContext.hasAuthorizer && awsContext.authorizer) {
        const authorizer = awsContext.authorizer;
        authContext = {
          userId: authorizer.userId || authorizer.username,
          email: authorizer.email,
          tokenType: 'cognito', // All tokens are now Cognito tokens
          emailVerified: authorizer.emailVerified === 'true',
          username: authorizer.username,
          tokenUse: authorizer.tokenUse,
          // Additional attributes for federated users
          name: authorizer.name || '',
          givenName: authorizer.givenName || '',
          familyName: authorizer.familyName || '',
          picture: authorizer.picture || '',
        };
      }
      
      // Fallback to headers if not in authorizer context
      if (!authContext) {
        authContext = authorizationService.createAuthContextFromHeaders(request.headers || {});
      }
      
      request.authContext = authContext;
    } else {
      // Local/Development Environment: Handle authorization directly
      logger.info('Processing local environment request');
      
      const authHeader = request.headers?.authorization || request.headers?.Authorization;
      let authContext: AuthContext | null = null;
      
      // Handle JWT Bearer token authorization
      if (authHeader) {
        try {
          authContext = await authorizationService.authorizeRequest(authHeader);
          
          logger.info('Local authorization successful', {
            userId: authContext.userId,
            email: authContext.email,
            tokenType: authContext.tokenType,
          });
        } catch (error) {
          logger.error('Local authorization failed', error);
          authContext = null;
        }
      }
      
      request.authContext = authContext;
    }

    logger.info('AuthMiddleware completed', {
      hasAuthContext: !!request.authContext,
      environment: environmentContext.isAWS ? 'aws' : 'local',
      requestId: environmentContext.requestId,
    });
  });
}

/**
 * Middleware to ensure authentication for protected routes
 */
export function requireAuth(app: FastifyInstance): void {
  app.addHook('preHandler', async (request: any, reply) => {
    const logger = new Logger({ service: 'RequireAuth' });
    
    logger.info('Checking authentication', {
      url: request.url,
      method: request.method,
      hasAuthContext: !!request.authContext,
    });

    if (!request.authContext) {
      logger.error('Authentication required but not found');
      reply.code(401);
      throw new Error('Unauthorized');
    }

    logger.info('Authentication verified', {
      userId: request.authContext.userId,
      email: request.authContext.email,
      tokenType: request.authContext.tokenType,
    });
  });
} 