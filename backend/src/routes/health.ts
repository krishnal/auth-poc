import { FastifyInstance } from 'fastify';

/**
 * Health check routes
 */
export function registerHealthRoutes(app: FastifyInstance): void {
  // Basic health check
  app.get('/health', async () => {
    return { 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'auth-poc-backend',
    };
  });

  // Detailed health check with system info
  app.get('/health/detailed', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'auth-poc-backend',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
    };
  });
} 