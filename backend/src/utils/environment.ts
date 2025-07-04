import { APIGatewayProxyEvent } from 'aws-lambda';
import { getConfig } from '../config';

export interface EnvironmentContext {
  isAWS: boolean;
  isLocal: boolean;
  isProduction: boolean;
  isDevelopment: boolean;
  stage: string;
  requestId?: string;
  region?: string;
}

export interface AWSEventContext {
  event: APIGatewayProxyEvent;
  requestContext: any;
  hasAuthorizer: boolean;
  authorizer?: any;
}

export class EnvironmentDetector {
  private static instance: EnvironmentDetector;
  private config = getConfig();

  private constructor() {}

  static getInstance(): EnvironmentDetector {
    if (!EnvironmentDetector.instance) {
      EnvironmentDetector.instance = new EnvironmentDetector();
    }
    return EnvironmentDetector.instance;
  }

  /**
   * Detects if we're running in AWS Lambda environment
   * @param event - The Lambda event object (if available)
   * @returns boolean indicating if we're in AWS
   */
  isAWSEnvironment(event?: any): boolean {
    // Primary detection: Check for AWS Lambda event context
    if (event?.requestContext) {
      return true;
    }

    // Secondary detection: Check for AWS Lambda runtime environment
    if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV) {
      return true;
    }

    // Tertiary detection: Check for AWS region and other AWS-specific env vars
    if (process.env.AWS_REGION && process.env.AWS_LAMBDA_RUNTIME_API) {
      return true;
    }

    return false;
  }

  /**
   * Gets comprehensive environment context
   * @param event - Optional Lambda event object
   * @returns EnvironmentContext with all environment information
   */
  getEnvironmentContext(event?: any): EnvironmentContext {
    const isAWS = this.isAWSEnvironment(event);
    const isProduction = this.config.app.nodeEnv === 'production';
    
    return {
      isAWS,
      isLocal: !isAWS,
      isProduction,
      isDevelopment: !isProduction,
      stage: this.config.app.stage,
      requestId: event?.requestContext?.requestId || this.generateRequestId(),
      region: isAWS ? (event?.requestContext?.region || this.config.aws.region) : undefined,
    };
  }

  /**
   * Extracts AWS-specific event context from Lambda event
   * @param event - The Lambda event object
   * @returns AWSEventContext with AWS-specific information
   */
  extractAWSEventContext(event: any): AWSEventContext | null {
    if (!this.isAWSEnvironment(event)) {
      return null;
    }

    return {
      event,
      requestContext: event.requestContext,
      hasAuthorizer: !!event.requestContext?.authorizer,
      authorizer: event.requestContext?.authorizer,
    };
  }

  /**
   * Safely extracts the Lambda event from various possible sources
   * @param request - Fastify request object
   * @param globalEvent - Global event storage
   * @returns The Lambda event or null
   */
  extractLambdaEvent(request: any, globalEvent?: any): any {
    // Priority order for event extraction
    const possibleEvents = [
      globalEvent,
      request.awsLambda?.event,
      request.event,
      request.lambdaEvent,
    ];

    for (const event of possibleEvents) {
      if (event && this.isAWSEnvironment(event)) {
        return event;
      }
    }

    return null;
  }

  /**
   * Generates a unique request ID for local development
   * @returns A unique request ID string
   */
  private generateRequestId(): string {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const environmentDetector = EnvironmentDetector.getInstance();

// Convenience functions for common use cases
export function isAWSEnvironment(event?: any): boolean {
  return environmentDetector.isAWSEnvironment(event);
}

export function getEnvironmentContext(event?: any): EnvironmentContext {
  return environmentDetector.getEnvironmentContext(event);
}

export function extractAWSEventContext(event: any): AWSEventContext | null {
  return environmentDetector.extractAWSEventContext(event);
}

export function extractLambdaEvent(request: any, globalEvent?: any): any {
  return environmentDetector.extractLambdaEvent(request, globalEvent);
} 