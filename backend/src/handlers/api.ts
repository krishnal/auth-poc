// backend/src/handlers/api.ts
import { fastify, FastifyInstance } from 'fastify';
import awsLambdaFastify from '@fastify/aws-lambda';
import cors from '@fastify/cors';
import { AuthService } from '../services/auth-service';
import { UserService } from '../services/user-service';
import { AuthorizationService, AuthContext } from '../services/authorization-service';
import { getConfig } from '../config';
import { 
  getEnvironmentContext, 
  extractLambdaEvent, 
  extractAWSEventContext 
} from '../utils/environment';
import { handleError, extractErrorMessage } from '../utils/errors';
import { Logger } from '../utils/logger';
import { createErrorResponse, createSuccessResponse } from '../utils/response';
import {
  LoginRequest,
  SignupRequest,
  GoogleAuthRequest,
  RefreshTokenRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../types/auth';

// Store the current Lambda event globally so we can access it in preHandler
let currentLambdaEvent: any = null;

// Create Fastify instance
const createFastifyApp = (): FastifyInstance => {
  const config = getConfig();
  
  const app = fastify({
    logger: false, // We'll use our custom logger
  });

  // Register CORS with centralized configuration
  app.register(cors, {
    origin: config.cors.allowedDomains,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Initialize services with context
  const authService = new AuthService();
  const userService = new UserService();
  const authorizationService = new AuthorizationService();

  // Middleware to extract auth context from API Gateway or handle local authorization
  app.addHook('preHandler', async (request: any) => {
    const logger = new Logger({ service: 'PreHandler' });
    
    // Extract Lambda event using the environment utility
    const event = extractLambdaEvent(request, currentLambdaEvent);
    const environmentContext = getEnvironmentContext(event);
    const awsContext = extractAWSEventContext(event);
    
    logger.info('Processing request', {
      url: request.url,
      method: request.method,
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
          tokenType: authorizer.tokenType as 'cognito' | 'google',
          emailVerified: authorizer.emailVerified === 'true',
          ...(authorizer.tokenType === 'cognito' && {
            username: authorizer.username,
            tokenUse: authorizer.tokenUse,
          }),
          ...(authorizer.tokenType === 'google' && {
            name: authorizer.name,
            givenName: authorizer.givenName,
            familyName: authorizer.familyName,
            picture: authorizer.picture,
          }),
        };
      }
      
      // Fallback to headers if not in authorizer context
      if (!authContext) {
        authContext = authorizationService.createAuthContextFromHeaders(request.headers || {});
      }
      
      request.authContext = authContext;
    } else {
      // Local Environment: Handle authorization directly
      logger.info('Processing local environment request');
      
      const authHeader = request.headers?.authorization || request.headers?.Authorization;
      
      if (authHeader) {
        try {
          const authContext = await authorizationService.authorizeRequest(authHeader);
          request.authContext = authContext;
          
          logger.info('Local authorization successful', {
            userId: authContext.userId,
            email: authContext.email,
            tokenType: authContext.tokenType,
          });
        } catch (error) {
          logger.error('Local authorization failed', error);
          request.authContext = null;
        }
      } else {
        request.authContext = null;
      }
    }

    logger.info('PreHandler completed', {
      hasAuthContext: !!request.authContext,
      environment: environmentContext.isAWS ? 'aws' : 'local',
      requestId: environmentContext.requestId,
    });
  });

  // Health check
  app.get('/health', async () => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  });

  // Debug endpoint to see what headers we receive
  app.get('/debug/headers', async (request: any) => {
    const event = currentLambdaEvent || request.awsLambda?.event || request.event || (request as any).lambdaEvent;
    
    return {
      status: 'debug',
      requestHeaders: request.headers,
      eventHeaders: event?.headers,
      hasEvent: !!event,
      hasRequestContext: !!event?.requestContext,
      hasAuthorizer: !!event?.requestContext?.authorizer,
      authorizer: event?.requestContext?.authorizer,
      timestamp: new Date().toISOString(),
    };
  });

  // Authentication routes
  app.register(async (fastify) => {
    // Login with email/password
    fastify.post<{ Body: LoginRequest }>('/auth/login', async (request, reply) => {
      const logger = new Logger({ action: 'login', email: request.body.email });
      
      try {
        logger.info('Login attempt started');
        
        const result = await authService.login(request.body);
        
        logger.info('Login successful');
        return createSuccessResponse(result);
      } catch (error) {
        logger.error('Login failed', error);
        reply.code(401);
        return createErrorResponse(401, 'Invalid credentials');
      }
    });

    // Signup with email/password
    fastify.post<{ Body: SignupRequest }>('/auth/signup', async (request, reply) => {
      const logger = new Logger({ action: 'signup', email: request.body.email });
      
      try {
        logger.info('Signup attempt started');
        
        const result = await authService.signup(request.body);
        
        logger.info('Signup successful');
        return createSuccessResponse(result);
      } catch (error) {
        logger.error('Signup failed', error);
        reply.code(400);
        return createErrorResponse(400, extractErrorMessage(error, 'Signup failed'));
      }
    });

    // Google OAuth
    fastify.post<{ Body: GoogleAuthRequest }>('/auth/google', async (request, reply) => {
      const logger = new Logger({ action: 'google-auth' });
      
      try {
        logger.info('Google auth attempt started');
        
        const result = await authService.authenticateWithGoogle(request.body);
        
        logger.info('Google auth successful');
        return createSuccessResponse(result);
      } catch (error) {
        logger.error('Google auth failed', error);
        reply.code(400);
        return createErrorResponse(400, extractErrorMessage(error, 'Google authentication failed'));
      }
    });

    // Refresh token
    fastify.post<{ Body: RefreshTokenRequest }>('/auth/refresh', async (request, reply) => {
      const logger = new Logger({ action: 'refresh-token' });
      
      try {
        logger.info('Token refresh attempt started');
        
        const result = await authService.refreshToken(request.body);
        
        logger.info('Token refresh successful');
        return createSuccessResponse(result);
      } catch (error) {
        logger.error('Token refresh failed', error);
        reply.code(401);
        return createErrorResponse(401, 'Invalid refresh token');
      }
    });

    // Forgot password
    fastify.post<{ Body: ForgotPasswordRequest }>('/auth/password/forgot', async (request, reply) => {
      const logger = new Logger({ action: 'forgot-password', email: request.body.email });
      
      try {
        logger.info('Forgot password attempt started');
        
        await authService.forgotPassword(request.body);
        
        logger.info('Forgot password email sent');
        return createSuccessResponse({ message: 'Reset code sent to email' });
      } catch (error) {
        logger.error('Forgot password failed', error);
        reply.code(400);
        return createErrorResponse(400, extractErrorMessage(error, 'Failed to send reset code'));
      }
    });

    // Reset password
    fastify.post<{ Body: ResetPasswordRequest }>('/auth/password/reset', async (request, reply) => {
      const logger = new Logger({ action: 'reset-password', email: request.body.email });
      
      try {
        logger.info('Password reset attempt started');
        
        await authService.resetPassword(request.body);
        
        logger.info('Password reset successful');
        return createSuccessResponse({ message: 'Password reset successful' });
      } catch (error) {
        logger.error('Password reset failed', error);
        reply.code(400);
        return createErrorResponse(400, extractErrorMessage(error, 'Password reset failed'));
      }
    });
  });

  // Protected API routes
  app.register(async (fastify) => {
    // Middleware to ensure authentication
    fastify.addHook('preHandler', async (request: any, reply) => {
      console.log('Protected route preHandler', {
        hasAuthContext: !!request.authContext,
        authContext: request.authContext,
        url: request.url,
        method: request.method,
      });

      if (!request.authContext) {
        console.log('Authentication failed: No authContext found');
        reply.code(401);
        throw new Error('Unauthorized');
      }

      console.log('Authentication successful for protected route', {
        userId: request.authContext.userId,
        email: request.authContext.email,
        tokenType: request.authContext.tokenType,
      });
    });

    // Get user profile
    fastify.get('/api/user', async (request: any) => {
      const logger = new Logger({ 
        action: 'get-user-profile', 
        userId: request.authContext.userId 
      });
      
      try {
        logger.info('Getting user profile');
        
        const user = await userService.getUserProfile(request.authContext.userId);
        
        logger.info('User profile retrieved');
        return createSuccessResponse(user);
      } catch (error) {
        logger.error('Failed to get user profile', error);
        throw error;
      }
    });

    // Update user profile
    fastify.put<{ Body: any }>('/api/user', async (request: any) => {
      const logger = new Logger({ 
        action: 'update-user-profile', 
        userId: request.authContext.userId 
      });
      
      try {
        logger.info('Updating user profile');
        
        const updatedUser = await userService.updateUserProfile(
          request.authContext.userId,
          request.body
        );
        
        logger.info('User profile updated');
        return createSuccessResponse(updatedUser);
      } catch (error) {
        logger.error('Failed to update user profile', error);
        throw error;
      }
    });

    // Get protected data
    fastify.get('/api/data', async (request: any) => {
      const logger = new Logger({ 
        action: 'get-protected-data', 
        userId: request.authContext.userId 
      });
      
      try {
        logger.info('Getting protected data');
        
        const data = {
          message: 'This is protected data',
          user: {
            id: request.authContext.userId,
            email: request.authContext.email,
            tokenType: request.authContext.tokenType,
          },
          timestamp: new Date().toISOString(),
          requestId: request.id,
        };
        
        logger.info('Protected data retrieved');
        return createSuccessResponse(data);
      } catch (error) {
        logger.error('Failed to get protected data', error);
        throw error;
      }
    });

    // Auth context test endpoint
    fastify.get('/api/auth-test', async (request: any) => {
      const logger = new Logger({ 
        action: 'auth-test', 
        userId: request.authContext.userId 
      });
      
      try {
        logger.info('Testing auth context');
        
        const authContextData = {
          message: 'Auth context test successful',
          authContext: request.authContext,
          timestamp: new Date().toISOString(),
        };
        
        logger.info('Auth context test completed');
        return createSuccessResponse(authContextData);
      } catch (error) {
        logger.error('Auth context test failed', error);
        throw error;
      }
    });
  });

  return app;
};

// Create app instance
const app = createFastifyApp();

// Custom Lambda handler that properly exposes event context
export const handler = async (event: any, context: any) => {
  const environmentContext = getEnvironmentContext(event);
  const logger = new Logger({ 
    service: 'LambdaHandler',
    requestId: environmentContext.requestId 
  });
  
  logger.info('Lambda handler started', {
    method: event.httpMethod,
    path: event.path,
    isAWS: environmentContext.isAWS,
    stage: environmentContext.stage,
  });

  // Store the event globally so preHandler can access it
  currentLambdaEvent = event;

  try {
    // Use the standard awsLambdaFastify handler
    const wrappedHandler = awsLambdaFastify(app);
    const result = await wrappedHandler(event, context);

    logger.info('Lambda handler completed successfully', {
      statusCode: result.statusCode,
      hasBody: !!result.body,
    });

    return result;
  } catch (error) {
    logger.error('Lambda handler failed', error);
    
    // Use centralized error handling
    const errorResponse = handleError(error, {
      ...environmentContext,
      action: 'lambda-handler',
    });

    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': getConfig().cors.origin,
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify(errorResponse.body),
    };
  } finally {
    // Clear the global event
    currentLambdaEvent = null;
  }
};

// For local development
if (require.main === module) {
  const start = async () => {
    try {
      await app.listen({ port: 3001, host: '0.0.0.0' });
      console.log('Server listening on http://localhost:3001');
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };
  start();
}