import {
    InitiateAuthCommand,
    SignUpCommand,
    ForgotPasswordCommand,
    ConfirmForgotPasswordCommand,
    AdminGetUserCommand,
    AdminCreateUserCommand,
  } from '@aws-sdk/client-cognito-identity-provider';
  import {
    LoginRequest,
    SignupRequest,
    GoogleAuthRequest,
    RefreshTokenRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    CognitoAuthResult,
  } from '../types/auth';
  import { BaseService, ServiceContext } from './base-service';
  import { 
    AuthenticationError, 
    CognitoServiceError, 
    InvalidTokenError 
  } from '../utils/errors';
  
  export class AuthService extends BaseService {
    constructor(context: ServiceContext = {}) {
      super('AuthService', context);
      this.validateConfiguration();
    }
  
    async login(request: LoginRequest): Promise<CognitoAuthResult> {
      return this.executeOperation(
        async () => {
          const command = new InitiateAuthCommand({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: this.config.aws.cognito.clientId,
            AuthParameters: {
              USERNAME: request.email,
              PASSWORD: request.password,
              SECRET_HASH: this.calculateSecretHash(request.email),
            },
          });
    
          const response = await this.cognitoClient.send(command);
          
          if (!response.AuthenticationResult) {
            throw new AuthenticationError('Authentication failed');
          }
    
          return {
            accessToken: response.AuthenticationResult.AccessToken!,
            idToken: response.AuthenticationResult.IdToken!,
            refreshToken: response.AuthenticationResult.RefreshToken!,
            expiresIn: response.AuthenticationResult.ExpiresIn!,
            tokenType: response.AuthenticationResult.TokenType!,
          };
        },
        'User Login',
        { email: request.email }
      );
    }
  
    async signup(request: SignupRequest): Promise<{ userSub: string; message: string }> {
      return this.executeOperation(
        async () => {
          const userAttributes = this.createUserAttributes({
            email: request.email,
            ...(request.givenName && { given_name: request.givenName }),
            ...(request.familyName && { family_name: request.familyName }),
          });
    
          const command = new SignUpCommand({
            ClientId: this.config.aws.cognito.clientId,
            Username: request.email,
            Password: request.password,
            UserAttributes: userAttributes,
            SecretHash: this.calculateSecretHash(request.email),
          });
    
          const response = await this.cognitoClient.send(command);
    
          if (!response.UserSub) {
            throw new CognitoServiceError('Failed to create user - no user ID returned');
          }
    
          return {
            userSub: response.UserSub,
            message: 'User created successfully. Please check your email for verification.',
          };
        },
        'User Signup',
        { email: request.email }
      );
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
      return this.executeOperation(
        async () => {
          try {
            // Try to get existing user
            const user = await this.cognitoClient.send(new AdminGetUserCommand({
              UserPoolId: this.config.aws.cognito.userPoolId,
              Username: googleUser.email,
            }));
            
            this.createLogger({ email: googleUser.email }).info('Google user already exists in Cognito');
            return user;
          } catch (error) {
            // User doesn't exist, create them as federated user
            const userAttributes = this.createUserAttributes({
              email: googleUser.email,
              email_verified: 'true',
              given_name: googleUser.given_name || '',
              family_name: googleUser.family_name || '',
            });

            const user = await this.cognitoClient.send(new AdminCreateUserCommand({
              UserPoolId: this.config.aws.cognito.userPoolId,
              Username: googleUser.email,
              UserAttributes: userAttributes,
              MessageAction: 'SUPPRESS',
              // No password - this is a federated user
            }));

            this.createLogger({ email: googleUser.email }).info('Created Google federated user in Cognito');
            return user;
          }
        },
        'Ensure Google User Exists',
        { email: googleUser.email }
      );
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
      return this.executeOperation(
        async () => {
          const command = new InitiateAuthCommand({
            AuthFlow: 'REFRESH_TOKEN_AUTH',
            ClientId: this.config.aws.cognito.clientId,
            AuthParameters: {
              REFRESH_TOKEN: request.refreshToken,
              SECRET_HASH: this.calculateSecretHash(''), // Username not needed for refresh
            },
          });
    
          const response = await this.cognitoClient.send(command);
    
          if (!response.AuthenticationResult) {
            throw new InvalidTokenError('Token refresh failed');
          }
    
          return {
            accessToken: response.AuthenticationResult.AccessToken!,
            idToken: response.AuthenticationResult.IdToken!,
            refreshToken: request.refreshToken, // Refresh token doesn't change
            expiresIn: response.AuthenticationResult.ExpiresIn!,
            tokenType: response.AuthenticationResult.TokenType!,
          };
        },
        'Token Refresh',
        { refreshToken: request.refreshToken.substring(0, 10) + '...' }
      );
    }
  
    async forgotPassword(request: ForgotPasswordRequest): Promise<void> {
      return this.executeOperation(
        async () => {
          const command = new ForgotPasswordCommand({
            ClientId: this.config.aws.cognito.clientId,
            Username: request.email,
            SecretHash: this.calculateSecretHash(request.email),
          });
    
          await this.cognitoClient.send(command);
        },
        'Forgot Password',
        { email: request.email }
      );
    }
  
    async resetPassword(request: ResetPasswordRequest): Promise<void> {
      return this.executeOperation(
        async () => {
          const command = new ConfirmForgotPasswordCommand({
            ClientId: this.config.aws.cognito.clientId,
            Username: request.email,
            ConfirmationCode: request.confirmationCode,
            Password: request.newPassword,
            SecretHash: this.calculateSecretHash(request.email),
          });
    
          await this.cognitoClient.send(command);
        },
        'Password Reset',
        { email: request.email }
      );
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