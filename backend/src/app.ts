import { FastifyInstance, fastify } from 'fastify';
import { getConfig } from './config';
import { Logger } from './utils/logger';

// Import middleware
import { registerCors } from './middleware/cors';
import { registerAuth } from './middleware/auth';

// Import route modules
import { registerHealthRoutes } from './routes/health';
import { registerAuthRoutes } from './routes/auth';
import { registerUserRoutes } from './routes/users';

export interface AppOptions {
  environment?: 'development' | 'lambda';
  logger?: boolean;
}

/**
 * Creates and configures the main Fastify application
 * This factory can be used by both development server and Lambda handler
 */
export function createApp(options: AppOptions = {}): FastifyInstance {
  const config = getConfig();
  const logger = new Logger({ service: 'App' });
  
  const app = fastify({
    logger: options.logger ?? false,
  });

  logger.info('Creating Fastify application', {
    environment: options.environment || 'unknown',
    stage: config.app.stage,
  });

  // Register middleware in order
  registerCors(app, config);
  registerAuth(app, options.environment);

  // Register route modules
  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerUserRoutes(app);

  logger.info('Fastify application created successfully');
  
  return app;
} 