import awsLambdaFastify from '@fastify/aws-lambda';
import { createApp } from './app';
import { setLambdaEvent, clearLambdaEvent } from './middleware/auth';
import { getEnvironmentContext } from './utils/environment';
import { handleError } from './utils/errors';
import { getConfig } from './config';
import { Logger } from './utils/logger';

/**
 * Create the Fastify app instance for Lambda
 */
const app = createApp({ 
  environment: 'lambda',
  logger: false 
});

/**
 * AWS Lambda handler
 * Uses the shared app factory for consistency with development server
 */
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

  // Set the Lambda event for the auth middleware
  setLambdaEvent(event);

  try {
    // Use the standard awsLambdaFastify handler with our shared app
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
    // Clear the Lambda event
    clearLambdaEvent();
  }
}; 