import { Logger } from './logger';
import { EnvironmentContext } from './environment';

// Base error class with additional context
export abstract class BaseError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly timestamp: string;
  public readonly requestId?: string;

  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    isOperational: boolean = true,
    requestId?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.requestId = requestId;

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, BaseError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      timestamp: this.timestamp,
      requestId: this.requestId,
      ...(process.env.NODE_ENV !== 'production' && { stack: this.stack }),
    };
  }
}

// Authentication & Authorization Errors
export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication failed', requestId?: string) {
    super(message, 401, 'AUTH_001', true, requestId);
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string = 'Access denied', requestId?: string) {
    super(message, 403, 'AUTH_002', true, requestId);
  }
}

export class TokenExpiredError extends BaseError {
  constructor(message: string = 'Token has expired', requestId?: string) {
    super(message, 401, 'AUTH_003', true, requestId);
  }
}

export class InvalidTokenError extends BaseError {
  constructor(message: string = 'Invalid token', requestId?: string) {
    super(message, 401, 'AUTH_004', true, requestId);
  }
}

// Validation Errors
export class ValidationError extends BaseError {
  public readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]> = {}, requestId?: string) {
    super(message, 400, 'VAL_001', true, requestId);
    this.fieldErrors = fieldErrors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      fieldErrors: this.fieldErrors,
    };
  }
}

// Configuration Errors
export class ConfigurationError extends BaseError {
  constructor(message: string, requestId?: string) {
    super(message, 500, 'CFG_001', false, requestId);
  }
}

// External Service Errors
export class ExternalServiceError extends BaseError {
  public readonly service: string;

  constructor(message: string, service: string, requestId?: string) {
    super(message, 502, 'EXT_001', true, requestId);
    this.service = service;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      service: this.service,
    };
  }
}

export class CognitoServiceError extends ExternalServiceError {
  constructor(message: string, requestId?: string) {
    super(message, 'AWS Cognito', requestId);
  }
}

export class GoogleServiceError extends ExternalServiceError {
  constructor(message: string, requestId?: string) {
    super(message, 'Google OAuth', requestId);
  }
}

// Resource Errors
export class NotFoundError extends BaseError {
  public readonly resource: string;

  constructor(resource: string, requestId?: string) {
    super(`${resource} not found`, 404, 'RSC_001', true, requestId);
    this.resource = resource;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      resource: this.resource,
    };
  }
}

export class ConflictError extends BaseError {
  constructor(message: string, requestId?: string) {
    super(message, 409, 'RSC_002', true, requestId);
  }
}

// Rate Limiting Errors
export class RateLimitError extends BaseError {
  constructor(message: string = 'Rate limit exceeded', requestId?: string) {
    super(message, 429, 'LMT_001', true, requestId);
  }
}

// Error Handler Class
export class ErrorHandler {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Handles and logs errors consistently
   * @param error - The error to handle
   * @param context - Additional context information
   * @returns Formatted error response
   */
  handleError(error: unknown, context: EnvironmentContext & { action?: string }): {
    statusCode: number;
    body: any;
  } {
    const requestId = context.requestId || 'unknown';
    const logger = this.logger.withContext({ 
      requestId, 
      action: context.action,
      environment: context.isAWS ? 'aws' : 'local'
    });

    // Handle known application errors
    if (error instanceof BaseError) {
      logger.error('Application error occurred', {
        errorCode: error.errorCode,
        statusCode: error.statusCode,
        message: error.message,
        isOperational: error.isOperational,
      });

      return {
        statusCode: error.statusCode,
        body: {
          error: error.toJSON(),
          success: false,
        },
      };
    }

    // Handle AWS SDK errors
    if (this.isAWSError(error)) {
      const awsError = this.normalizeAWSError(error, requestId);
      logger.error('AWS service error occurred', {
        errorCode: awsError.errorCode,
        statusCode: awsError.statusCode,
        message: awsError.message,
                 awsErrorCode: (error as any).name,
      });

      return {
        statusCode: awsError.statusCode,
        body: {
          error: awsError.toJSON(),
          success: false,
        },
      };
    }

    // Handle validation errors (e.g., from Joi, Yup, etc.)
    if (this.isValidationError(error)) {
      const validationError = this.normalizeValidationError(error, requestId);
      logger.error('Validation error occurred', {
        errorCode: validationError.errorCode,
        statusCode: validationError.statusCode,
        message: validationError.message,
        fieldErrors: validationError.fieldErrors,
      });

      return {
        statusCode: validationError.statusCode,
        body: {
          error: validationError.toJSON(),
          success: false,
        },
      };
    }

    // Handle generic errors
    const genericError = this.normalizeGenericError(error, requestId, context);
    logger.error('Unexpected error occurred', {
      errorCode: genericError.errorCode,
      statusCode: genericError.statusCode,
      message: genericError.message,
      originalError: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      statusCode: genericError.statusCode,
      body: {
        error: genericError.toJSON(),
        success: false,
      },
    };
  }

  /**
   * Safely extracts error message from unknown error types
   * @param error - The error to extract message from
   * @param defaultMessage - Default message if extraction fails
   * @returns Error message string
   */
  extractErrorMessage(error: unknown, defaultMessage: string = 'An unexpected error occurred'): string {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
    
    return defaultMessage;
  }

  private isAWSError(error: any): boolean {
    return error && (
      error.name?.includes('Error') ||
      error.$metadata ||
      error.requestId ||
      error.cfId ||
      error.statusCode
    );
  }

  private isValidationError(error: any): boolean {
    return error && (
      error.name === 'ValidationError' ||
      error.isJoi ||
      error.details ||
      (error.errors && Array.isArray(error.errors))
    );
  }

  private normalizeAWSError(error: any, requestId: string): BaseError {
    const message = this.extractErrorMessage(error, 'AWS service error');
    
    if (error.name?.includes('Cognito') || error.name?.includes('CognitoIdentityProvider')) {
      return new CognitoServiceError(message, requestId);
    }
    
    return new ExternalServiceError(message, 'AWS', requestId);
  }

  private normalizeValidationError(error: any, requestId: string): ValidationError {
    const message = this.extractErrorMessage(error, 'Validation failed');
    const fieldErrors: Record<string, string[]> = {};
    
    // Handle Joi validation errors
    if (error.details && Array.isArray(error.details)) {
      error.details.forEach((detail: any) => {
        const field = detail.path?.join('.') || 'unknown';
        if (!fieldErrors[field]) {
          fieldErrors[field] = [];
        }
        fieldErrors[field].push(detail.message);
      });
    }
    
    return new ValidationError(message, fieldErrors, requestId);
  }

  private normalizeGenericError(error: unknown, requestId: string, context: EnvironmentContext): BaseError {
    const message = this.extractErrorMessage(error, 'An unexpected error occurred');
    
    // In development, provide more detailed error information
    if (context.isDevelopment) {
      return new class extends BaseError {
        constructor() {
          super(message, 500, 'GEN_001', false, requestId);
        }
      }();
    }
    
    // In production, provide generic error message
    return new class extends BaseError {
      constructor() {
        super('Internal server error', 500, 'GEN_001', false, requestId);
      }
    }();
  }
}

// Singleton error handler
let errorHandlerInstance: ErrorHandler | null = null;

export function getErrorHandler(): ErrorHandler {
  if (!errorHandlerInstance) {
    errorHandlerInstance = new ErrorHandler(new Logger({ service: 'ErrorHandler' }));
  }
  return errorHandlerInstance;
}

// Convenience functions
export function handleError(error: unknown, context: EnvironmentContext & { action?: string }) {
  return getErrorHandler().handleError(error, context);
}

export function extractErrorMessage(error: unknown, defaultMessage?: string): string {
  return getErrorHandler().extractErrorMessage(error, defaultMessage);
} 