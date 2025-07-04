import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { OAuth2Client } from 'google-auth-library';
import { createHmac } from 'crypto';
import { Logger } from '../utils/logger';
import { getConfig, AppConfig } from '../config';
import { getEnvironmentContext, EnvironmentContext } from '../utils/environment';

export interface ServiceContext {
  requestId?: string;
  userId?: string;
  email?: string;
  action?: string;
  environment?: EnvironmentContext;
}

export abstract class BaseService {
  protected config: AppConfig;
  protected logger: Logger;
  protected cognitoClient: CognitoIdentityProviderClient;
  protected googleClient: OAuth2Client;

  constructor(serviceName: string, context: ServiceContext = {}) {
    this.config = getConfig();
    this.logger = new Logger({ 
      service: serviceName,
      ...context
    });
    
    // Initialize AWS Cognito client
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: this.config.aws.region,
    });
    
    // Initialize Google OAuth client
    this.googleClient = new OAuth2Client(
      this.config.google.clientId,
      this.config.google.clientSecret
    );
  }

  /**
   * Creates a logger with additional context
   * @param additionalContext - Additional context to add to logger
   * @returns Logger instance with context
   */
  protected createLogger(additionalContext: Record<string, any> = {}): Logger {
    return this.logger.withContext(additionalContext);
  }

  /**
   * Calculates the Cognito secret hash required for authentication
   * @param username - The username to calculate hash for
   * @returns The calculated secret hash
   */
  protected calculateSecretHash(username: string): string {
    const message = username + this.config.aws.cognito.clientId;
    const secret = this.config.aws.cognito.clientSecret;
    
    if (!secret) {
      throw new Error('COGNITO_CLIENT_SECRET not configured');
    }
    
    return createHmac('sha256', secret).update(message).digest('base64');
  }

  /**
   * Gets the environment context for the current request
   * @param event - Optional Lambda event
   * @returns Environment context
   */
  protected getEnvironmentContext(event?: any): EnvironmentContext {
    return getEnvironmentContext(event);
  }

  /**
   * Validates required configuration before service operations
   * @throws Error if required configuration is missing
   */
  protected validateConfiguration(): void {
    if (!this.config.aws.cognito.userPoolId) {
      throw new Error('COGNITO_USER_POOL_ID is required');
    }
    if (!this.config.aws.cognito.clientId) {
      throw new Error('COGNITO_CLIENT_ID is required');
    }
    if (!this.config.google.clientId) {
      throw new Error('GOOGLE_CLIENT_ID is required');
    }
  }

  /**
   * Safely extracts user attributes from Cognito response
   * @param userAttributes - Array of user attributes from Cognito
   * @param attributeName - Name of the attribute to extract
   * @returns Attribute value or undefined
   */
  protected extractUserAttribute(userAttributes: any[], attributeName: string): string | undefined {
    const attribute = userAttributes?.find(attr => attr.Name === attributeName);
    return attribute?.Value;
  }

  /**
   * Creates user attributes array for Cognito operations
   * @param attributes - Object with attribute key-value pairs
   * @returns Array of Cognito user attributes
   */
  protected createUserAttributes(attributes: Record<string, string>): Array<{ Name: string; Value: string }> {
    return Object.entries(attributes)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => ({ Name: key, Value: String(value) }));
  }

  /**
   * Generates a unique identifier for operations
   * @returns Unique identifier string
   */
  protected generateUniqueId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handles async operations with consistent error handling
   * @param operation - The async operation to execute
   * @param operationName - Name of the operation for logging
   * @param context - Additional context for error handling
   * @returns Promise with the operation result
   */
  protected async executeOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Record<string, any> = {}
  ): Promise<T> {
    const logger = this.createLogger({ operation: operationName, ...context });
    
    try {
      logger.info(`${operationName} started`);
      const result = await operation();
      logger.info(`${operationName} completed successfully`);
      return result;
    } catch (error) {
      logger.error(`${operationName} failed`, error);
      throw error;
    }
  }
}

/**
 * Service factory for creating service instances with consistent configuration
 */
export class ServiceFactory {
  private static instance: ServiceFactory;
  private serviceInstances: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  /**
   * Gets or creates a service instance
   * @param ServiceClass - The service class to instantiate
   * @param serviceName - Name of the service
   * @param context - Service context
   * @returns Service instance
   */
  getService<T extends BaseService>(
    ServiceClass: new (serviceName: string, context?: ServiceContext) => T,
    serviceName: string,
    context: ServiceContext = {}
  ): T {
    const key = `${serviceName}-${JSON.stringify(context)}`;
    
    if (!this.serviceInstances.has(key)) {
      this.serviceInstances.set(key, new ServiceClass(serviceName, context));
    }
    
    return this.serviceInstances.get(key) as T;
  }

  /**
   * Clears all service instances (useful for testing)
   */
  clearServices(): void {
    this.serviceInstances.clear();
  }
}

// Singleton service factory instance
export const serviceFactory = ServiceFactory.getInstance(); 