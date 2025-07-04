import { createApp } from './app';
import { Logger } from './utils/logger';

/**
 * Development server entry point
 * Uses the shared app factory for consistency with Lambda handler
 */
const start = async () => {
  const logger = new Logger({ service: 'DevServer' });
  
  try {
    // Create app using the shared factory
    const app = createApp({ 
      environment: 'development',
      logger: false 
    });
    
    // Start the server
    await app.listen({ port: 3001, host: '0.0.0.0' });
    
    logger.info('Development server started successfully');
    console.log('🚀 Development server listening on http://localhost:3001');
    console.log('📚 API Documentation: http://localhost:3001/health');
    console.log('🔍 Detailed Health: http://localhost:3001/health/detailed');
    console.log('🔐 Auth Routes: http://localhost:3001/auth/*');
    console.log('👤 Protected API: http://localhost:3001/api/*');
  } catch (err) {
    logger.error('Failed to start development server', err);
    process.exit(1);
  }
};

// Start the server
start(); 