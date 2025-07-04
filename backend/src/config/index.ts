import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables for local development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

export interface AppConfig {
  // AWS Configuration
  aws: {
    region: string;
    cognito: {
      userPoolId: string;
      clientId: string;
      clientSecret: string;
    };
  };
  
  // Google OAuth Configuration
  google: {
    clientId: string;
    clientSecret: string;
  };
  
  // CORS Configuration
  cors: {
    origin: string;
    allowedDomains: string[];
  };
  
  // App Configuration
  app: {
    nodeEnv: string;
    stage: string;
    port: number;
  };
}

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function getRequiredEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new ConfigurationError(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnvVar(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function validateConfiguration(): AppConfig {
  try {
    const config: AppConfig = {
      aws: {
        region: getOptionalEnvVar('AWS_REGION', 'us-west-2'),
        cognito: {
          userPoolId: getRequiredEnvVar('COGNITO_USER_POOL_ID'),
          clientId: getRequiredEnvVar('COGNITO_CLIENT_ID'),
          clientSecret: getRequiredEnvVar('COGNITO_CLIENT_SECRET'),
        },
      },
      google: {
        clientId: getRequiredEnvVar('GOOGLE_CLIENT_ID'),
        clientSecret: getRequiredEnvVar('GOOGLE_CLIENT_SECRET'),
      },
      cors: {
        origin: getOptionalEnvVar('CORS_ORIGIN', '*'),
        allowedDomains: [
          'http://localhost:3000',
          'https://*.thinfra.net',
          'https://*.demo.krishnal.com',
        ],
      },
      app: {
        nodeEnv: getOptionalEnvVar('NODE_ENV', 'development'),
        stage: getOptionalEnvVar('STAGE', 'dev'),
        port: parseInt(getOptionalEnvVar('PORT', '3001'), 10),
      },
    };
    
    // Additional validation
    if (!config.aws.cognito.userPoolId.match(/^[a-z0-9-]+_[a-zA-Z0-9]+$/)) {
      throw new ConfigurationError('Invalid COGNITO_USER_POOL_ID format');
    }
    
    if (!config.google.clientId.includes('.googleusercontent.com')) {
      throw new ConfigurationError('Invalid GOOGLE_CLIENT_ID format');
    }
    
    return config;
  } catch (error) {
    if (error instanceof ConfigurationError) {
      throw error;
    }
    throw new ConfigurationError(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Singleton configuration instance
let configInstance: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = validateConfiguration();
  }
  return configInstance;
}

export function resetConfig(): void {
  configInstance = null;
}

export { ConfigurationError }; 