import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Logger } from '../utils/logger';
import { getConfig } from '../config';

export interface AuthContext {
  userId: string;
  email: string;
  tokenType: 'cognito';
  emailVerified: boolean;
  username?: string;
  tokenUse?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
}

export interface DecodedToken {
  sub: string;
  email: string;
  'cognito:username'?: string;
  aud: string;
  token_use?: string;
  scope?: string;
  auth_time?: number;
  iss: string;
  exp: number;
  iat: number;
  email_verified?: boolean;
  // Additional fields for federated users
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

// GoogleTokenPayload interface removed - now using Cognito federation

export class AuthorizationError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class AuthorizationService {
  private cognitoVerifier: CognitoJwtVerifier<any, any, any> | null = null;
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ service: 'AuthorizationService' });
  }

  private initializeVerifiers() {
    if (!this.cognitoVerifier) {
      const config = getConfig();
      this.cognitoVerifier = CognitoJwtVerifier.create({
        userPoolId: config.aws.cognito.userPoolId,
        tokenUse: 'access',
        clientId: config.aws.cognito.clientId,
      });
    }
  }

  extractTokenFromHeader(authorizationHeader: string): string {
    if (!authorizationHeader) {
      throw new AuthorizationError('Missing Authorization header');
    }

    const parts = authorizationHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new AuthorizationError('Invalid Authorization header format');
    }

    return parts[1];
  }

  async verifyCognitoToken(token: string): Promise<DecodedToken> {
    try {
      this.initializeVerifiers();
      
      if (!this.cognitoVerifier) {
        throw new AuthorizationError('Cognito verifier not initialized');
      }

      const payload = await this.cognitoVerifier.verify(token);
      this.logger.info('Cognito token verified successfully', { 
        sub: payload.sub, 
        email: payload.email 
      });
      
      return payload as unknown as DecodedToken;
    } catch (error) {
      this.logger.error('Cognito token verification failed:', error);
      throw new AuthorizationError('Invalid Cognito token');
    }
  }

  // All authentication now uses Cognito tokens (including federated users)

  async verifyToken(token: string): Promise<{ userInfo: DecodedToken; tokenType: 'cognito' }> {
    try {
      // All tokens are Cognito tokens (including federated users)
      const userInfo = await this.verifyCognitoToken(token);
      return { userInfo, tokenType: 'cognito' };
    } catch (error) {
      this.logger.error('Token verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AuthorizationError('Invalid token');
    }
  }

  createAuthContext(userInfo: DecodedToken, tokenType: 'cognito'): AuthContext {
    // All tokens are Cognito tokens, including federated users
    const baseContext: AuthContext = {
      userId: userInfo.sub,
      email: userInfo.email,
      tokenType,
      emailVerified: userInfo.email_verified || false,
    };

    // For Cognito tokens (including federated users)
    return {
      ...baseContext,
      username: userInfo['cognito:username'] || userInfo.sub,
      tokenUse: userInfo.token_use || '',
      // For federated users, additional provider info may be in custom attributes
      name: userInfo.name || '',
      givenName: userInfo.given_name || '',
      familyName: userInfo.family_name || '',
      picture: userInfo.picture || '',
    };
  }

  createAuthContextFromHeaders(headers: Record<string, string>): AuthContext | null {
    const userId = headers['x-auth-user-id'];
    const email = headers['x-auth-email'];
    const tokenType = headers['x-auth-token-type'] as 'cognito';
    const emailVerified = headers['x-auth-email-verified'] === 'true';

    if (!userId || !email || !tokenType) {
      return null;
    }

    // All tokens are Cognito tokens
    return {
      userId,
      email,
      tokenType,
      emailVerified,
      username: headers['x-auth-username'] || userId,
      tokenUse: headers['x-auth-token-use'] || '',
      name: headers['x-auth-name'] || '',
      givenName: headers['x-auth-given-name'] || '',
      familyName: headers['x-auth-family-name'] || '',
      picture: headers['x-auth-picture'] || '',
    };
  }

  async authorizeRequest(authorizationHeader: string): Promise<AuthContext> {
    try {
      const token = this.extractTokenFromHeader(authorizationHeader);
      const { userInfo, tokenType } = await this.verifyToken(token);
      return this.createAuthContext(userInfo, tokenType);
    } catch (error) {
      this.logger.error('Authorization request failed:', error);
      throw error;
    }
  }
} 