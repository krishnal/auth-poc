import {
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
    SignUpCommand,
    ConfirmSignUpCommand,
    ForgotPasswordCommand,
    ConfirmForgotPasswordCommand,
    GetUserCommand,
    AdminGetUserCommand,
    AdminCreateUserCommand,
    AdminSetUserPasswordCommand,
    AdminInitiateAuthCommand,
    RespondToAuthChallengeCommand,
  } from '@aws-sdk/client-cognito-identity-provider';
  import { OAuth2Client } from 'google-auth-library';
  import {
    LoginRequest,
    SignupRequest,
    GoogleAuthRequest,
    RefreshTokenRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    CognitoAuthResult,
  } from '../types/auth';
  import { Logger } from '../utils/logger';
  
  export class AuthService {
    private cognitoClient: CognitoIdentityProviderClient;
    private googleClient: OAuth2Client;
    private logger: Logger;
  
    constructor() {
      this.cognitoClient = new CognitoIdentityProviderClient({
        region: process.env.AWS_REGION || 'us-west-2',
      });
      
      this.googleClient = new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      
      this.logger = new Logger({ service: 'AuthService' });
    }
  
    async login(request: LoginRequest): Promise<CognitoAuthResult> {
      const logger = this.logger.withContext({ email: request.email });
      
      try {
        const command = new InitiateAuthCommand({
          AuthFlow: 'USER_PASSWORD_AUTH',
          ClientId: process.env.COGNITO_CLIENT_ID!,
          AuthParameters: {
            USERNAME: request.email,
            PASSWORD: request.password,
            SECRET_HASH: this.calculateSecretHash(request.email),
          },
        });
  
        const response = await this.cognitoClient.send(command);
        logger.error('response', response);
        if (!response.AuthenticationResult) {
          throw new Error('Authentication failed');
        }
  
        logger.info('User login successful');
  
        return {
          accessToken: response.AuthenticationResult.AccessToken!,
          idToken: response.AuthenticationResult.IdToken!,
          refreshToken: response.AuthenticationResult.RefreshToken!,
          expiresIn: response.AuthenticationResult.ExpiresIn!,
          tokenType: response.AuthenticationResult.TokenType!,
        };
      } catch (error) {
        logger.error('Login failed', error);
        throw error;
      }
    }
  
    async signup(request: SignupRequest): Promise<{ userSub: string; message: string }> {
      const logger = this.logger.withContext({ email: request.email });
      
      try {
        const userAttributes = [
          { Name: 'email', Value: request.email },
        ];
  
        if (request.givenName) {
          userAttributes.push({ Name: 'given_name', Value: request.givenName });
        }
  
        if (request.familyName) {
          userAttributes.push({ Name: 'family_name', Value: request.familyName });
        }
  
        const command = new SignUpCommand({
          ClientId: process.env.COGNITO_CLIENT_ID!,
          Username: request.email,
          Password: request.password,
          UserAttributes: userAttributes,
          SecretHash: this.calculateSecretHash(request.email),
        });
  
        const response = await this.cognitoClient.send(command);
  
        logger.info('User signup successful', { userSub: response.UserSub });
  
        return {
          userSub: response.UserSub!,
          message: 'User created successfully. Please check your email for verification.',
        };
      } catch (error) {
        logger.error('Signup failed', error);
        throw error;
      }
    }
  
    async authenticateWithGoogle(request: GoogleAuthRequest): Promise<CognitoAuthResult> {
      const logger = this.logger.withContext({ action: 'google-auth' });
      
      try {
        logger.info('Starting Google authentication with request', { 
          hasCode: !!request.code, 
          redirectUri: request.redirectUri 
        });

        // Exchange code for tokens with better error handling
        logger.info('Attempting token exchange with Google', {
          codeLength: request.code?.length,
          redirectUri: request.redirectUri,
          googleClientId: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...'
        });

        const { tokens } = await this.googleClient.getToken({
          code: request.code,
          redirect_uri: request.redirectUri,
        });

        if (!tokens.id_token) {
          throw new Error('No ID token received from Google');
        }

        logger.info('Google tokens received successfully');

        // Verify the Google token
        const ticket = await this.googleClient.verifyIdToken({
          idToken: tokens.id_token,
          audience: process.env.GOOGLE_CLIENT_ID!,
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          throw new Error('Invalid Google token payload or missing email');
        }

        logger.info('Google token verified', { email: payload.email });

        // For Google federated users, return a custom token structure
        // that bypasses Cognito password authentication entirely
        const federatedResult = await this.handleGoogleFederatedAuth(payload);

        logger.info('Google federated authentication successful');
        return federatedResult;
      } catch (error) {
        logger.error('Google authentication failed', error);
        throw error;
      }
    }
  
    

    private async handleGoogleFederatedAuth(googleUser: any): Promise<CognitoAuthResult> {
      try {
        // Ensure user exists in Cognito
        const user = await this.ensureGoogleUserExists(googleUser);
        console.log('user in handleGoogleFederatedAuth', user);
        // For federated users, we'll create a custom token structure
        // that mimics Cognito tokens but works with our authorizer

        const customTokens = this.createFederatedTokens({...googleUser, userId: user.Username});

        this.logger.info('Created federated tokens for Google user', { email: googleUser.email });
        return customTokens;
      } catch (error) {
        this.logger.error('Failed to handle Google federated auth', error);
        throw error;
      }
    }

    private async ensureGoogleUserExists(googleUser: any): Promise<any> {
      let user;
      try {
        // Try to get existing user
        user = await this.cognitoClient.send(new AdminGetUserCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID!,
          Username: googleUser.email,
        }));
        console.log('user in ensureGoogleUserExists', user);
        this.logger.info('Google user already exists in Cognito', { email: googleUser.email });
      } catch (error) {
        // User doesn't exist, create them as federated user
        try {
          user = await this.cognitoClient.send(new AdminCreateUserCommand({
            UserPoolId: process.env.COGNITO_USER_POOL_ID!,
            Username: googleUser.email,
            UserAttributes: [
              { Name: 'email', Value: googleUser.email },
              { Name: 'email_verified', Value: 'true' },
              { Name: 'given_name', Value: googleUser.given_name || '' },
              { Name: 'family_name', Value: googleUser.family_name || '' },
            ],
            MessageAction: 'SUPPRESS',
            // No password - this is a federated user
          }));

          this.logger.info('Created Google federated user in Cognito', { email: googleUser.email });
        } catch (createError) {
          this.logger.error('Failed to create Google user in Cognito', createError);
          throw createError;
        }
      }
      return user;
    }

    private createFederatedTokens(googleUser: any): CognitoAuthResult {
      // Create custom tokens that work with our authorizer
      // These will be recognized as Google tokens by the authorizer
      const basePayload = {
        sub: googleUser.userId,
        email: googleUser.email,
        email_verified: googleUser.email_verified,
        name: googleUser.name,
        given_name: googleUser.given_name,
        family_name: googleUser.family_name,
        picture: googleUser.picture,
        aud: process.env.GOOGLE_CLIENT_ID,
        iss: 'https://accounts.google.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
      };

      // Create a simple base64 encoded token that our authorizer can recognize
      const tokenPayload = Buffer.from(JSON.stringify(basePayload)).toString('base64');
      const customToken = `google.${tokenPayload}`;

      return {
        accessToken: customToken,
        idToken: customToken,
        refreshToken: '', // No refresh for federated tokens in this simple implementation
        expiresIn: 3600,
        tokenType: 'Bearer',
      };
    }
  
    async refreshToken(request: RefreshTokenRequest): Promise<CognitoAuthResult> {
      try {
        const command = new InitiateAuthCommand({
          AuthFlow: 'REFRESH_TOKEN_AUTH',
          ClientId: process.env.COGNITO_CLIENT_ID!,
          AuthParameters: {
            REFRESH_TOKEN: request.refreshToken,
            SECRET_HASH: this.calculateSecretHash(''), // Username not needed for refresh
          },
        });
  
        const response = await this.cognitoClient.send(command);
  
        if (!response.AuthenticationResult) {
          throw new Error('Token refresh failed');
        }
  
        return {
          accessToken: response.AuthenticationResult.AccessToken!,
          idToken: response.AuthenticationResult.IdToken!,
          refreshToken: request.refreshToken, // Refresh token doesn't change
          expiresIn: response.AuthenticationResult.ExpiresIn!,
          tokenType: response.AuthenticationResult.TokenType!,
        };
      } catch (error) {
        this.logger.error('Token refresh failed', error);
        throw error;
      }
    }
  
    async forgotPassword(request: ForgotPasswordRequest): Promise<void> {
      try {
        const command = new ForgotPasswordCommand({
          ClientId: process.env.COGNITO_CLIENT_ID!,
          Username: request.email,
          SecretHash: this.calculateSecretHash(request.email),
        });
  
        await this.cognitoClient.send(command);
        this.logger.info('Forgot password email sent', { email: request.email });
      } catch (error) {
        this.logger.error('Forgot password failed', error);
        throw error;
      }
    }
  
    async resetPassword(request: ResetPasswordRequest): Promise<void> {
      try {
        const command = new ConfirmForgotPasswordCommand({
          ClientId: process.env.COGNITO_CLIENT_ID!,
          Username: request.email,
          ConfirmationCode: request.confirmationCode,
          Password: request.newPassword,
          SecretHash: this.calculateSecretHash(request.email),
        });
  
        await this.cognitoClient.send(command);
        this.logger.info('Password reset successful', { email: request.email });
      } catch (error) {
        this.logger.error('Password reset failed', error);
        throw error;
      }
    }
  
    private calculateSecretHash(username: string): string {
      const crypto = require('crypto');
      const message = username + process.env.COGNITO_CLIENT_ID;
      const secret = process.env.COGNITO_CLIENT_SECRET;
      
      if (!secret) {
        throw new Error('COGNITO_CLIENT_SECRET not configured');
      }
      
      return crypto.createHmac('sha256', secret).update(message).digest('base64');
    }
  
    private generateTemporaryPassword(): string {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      let password = '';
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    }
  }