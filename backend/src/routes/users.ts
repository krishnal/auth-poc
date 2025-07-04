import { FastifyInstance } from 'fastify';
import { UserService } from '../services/user-service';
import { Logger } from '../utils/logger';
import { createSuccessResponse } from '../utils/response';
import { requireAuth } from '../middleware/auth';

/**
 * User management routes (protected)
 */
export function registerUserRoutes(app: FastifyInstance): void {
  const userService = new UserService();

  // Register protected API routes under /api prefix
  app.register(async (fastify) => {
    // Apply authentication middleware to all routes in this context
    requireAuth(fastify);

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
} 