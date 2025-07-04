import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { OAuth2Client } from 'google-auth-library';
import { Logger } from '../utils/logger';
import { getConfig } from '../config';

export interface AuthContext {
  userId: string;
  email: string;
  tokenType: 'cognito' | 'google';
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
}

export interface GoogleTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
}

export class AuthorizationError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class AuthorizationService {
  private cognitoVerifier: CognitoJwtVerifier<any, any, any> | null = null;
  private googleClient: OAuth2Client | null = null;
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

    if (!this.googleClient) {
      const config = getConfig();
      this.googleClient = new OAuth2Client(config.google.clientId);
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

  async verifyGoogleToken(token: string): Promise<GoogleTokenPayload> {
    try {
      // Check if this is our custom federated token format
      if (token.startsWith('google.')) {
        return this.verifyCustomGoogleToken(token);
      }

      // Otherwise, verify as standard Google ID token
      this.initializeVerifiers();
      
      if (!this.googleClient) {
        throw new AuthorizationError('Google client not initialized');
      }

      const config = getConfig();
      const ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: config.google.clientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new AuthorizationError('Invalid Google token payload');
      }

      this.logger.info('Google token verified successfully', { 
        sub: payload.sub, 
        email: payload.email 
      });
      
      return payload as GoogleTokenPayload;
    } catch (error) {
      this.logger.error('Google token verification failed:', error);
      throw new AuthorizationError('Invalid Google token');
    }
  }

  verifyCustomGoogleToken(token: string): GoogleTokenPayload {
    try {
      // Extract the base64 payload from our custom token
      const base64Payload = token.substring('google.'.length);
      const payloadString = Buffer.from(base64Payload, 'base64').toString();
      const payload = JSON.parse(payloadString);

      // Verify token hasn't expired
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        throw new AuthorizationError('Token has expired');
      }

      // Verify audience
      const config = getConfig();
      if (payload.aud !== config.google.clientId) {
        throw new AuthorizationError('Invalid token audience');
      }

      this.logger.info('Custom Google token verified successfully', { 
        sub: payload.sub, 
        email: payload.email 
      });
      
      return payload as GoogleTokenPayload;
    } catch (error) {
      this.logger.error('Custom Google token verification failed:', error);
      throw new AuthorizationError('Invalid custom Google token');
    }
  }

  async verifyToken(token: string): Promise<{ userInfo: DecodedToken | GoogleTokenPayload; tokenType: 'cognito' | 'google' }> {
    let userInfo: DecodedToken | GoogleTokenPayload;
    let tokenType: 'cognito' | 'google';

    try {
      // Try Cognito first
      userInfo = await this.verifyCognitoToken(token);
      tokenType = 'cognito';
    } catch (cognitoError) {
      try {
        // If Cognito fails, try Google
        userInfo = await this.verifyGoogleToken(token);
        tokenType = 'google';
      } catch (googleError) {
        this.logger.error('Both token verifications failed', {
          cognitoError: cognitoError instanceof Error ? cognitoError.message : 'Unknown error',
          googleError: googleError instanceof Error ? googleError.message : 'Unknown error',
        });
        throw new AuthorizationError('Invalid token');
      }
    }

    return { userInfo, tokenType };
  }

  createAuthContext(userInfo: DecodedToken | GoogleTokenPayload, tokenType: 'cognito' | 'google'): AuthContext {
    const baseContext: AuthContext = {
      userId: userInfo.sub,
      email: userInfo.email,
      tokenType,
      emailVerified: userInfo.email_verified || false,
    };

    if (tokenType === 'cognito') {
      const cognitoUser = userInfo as DecodedToken;
      return {
        ...baseContext,
        username: cognitoUser['cognito:username'] || cognitoUser.sub,
        tokenUse: cognitoUser.token_use || '',
      };
    } else {
      const googleUser = userInfo as GoogleTokenPayload;
      return {
        ...baseContext,
        name: googleUser.name || '',
        givenName: googleUser.given_name || '',
        familyName: googleUser.family_name || '',
        picture: googleUser.picture || '',
      };
    }
  }

  createAuthContextFromHeaders(headers: Record<string, string>): AuthContext | null {
    const userId = headers['x-auth-user-id'];
    const email = headers['x-auth-email'];
    const tokenType = headers['x-auth-token-type'] as 'cognito' | 'google';
    const emailVerified = headers['x-auth-email-verified'] === 'true';

    if (!userId || !email || !tokenType) {
      return null;
    }

    const baseContext: AuthContext = {
      userId,
      email,
      tokenType,
      emailVerified,
    };

    if (tokenType === 'cognito') {
      return {
        ...baseContext,
        username: headers['x-auth-username'] || userId,
        tokenUse: headers['x-auth-token-use'] || '',
      };
    } else {
      return {
        ...baseContext,
        name: headers['x-auth-name'] || '',
        givenName: headers['x-auth-given-name'] || '',
        familyName: headers['x-auth-family-name'] || '',
        picture: headers['x-auth-picture'] || '',
      };
    }
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