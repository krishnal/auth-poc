import {
    InitiateAuthCommand,
    SignUpCommand,
    ForgotPasswordCommand,
    ConfirmForgotPasswordCommand,
  } from '@aws-sdk/client-cognito-identity-provider';
  import axios from 'axios';
  import {
    LoginRequest,
    SignupRequest,
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

    /**
     * Constructs the Cognito OAuth2 authorize URL for Google authentication
     * @param redirectUri - The callback URL after authentication
     * @returns The OAuth2 authorize URL
     */
    getGoogleAuthUrl(redirectUri: string): string {
      const cognitoDomain = this.config.aws.cognito.domain;
      const clientId = this.config.aws.cognito.clientId;
      
      if (!cognitoDomain) {
        throw new Error('COGNITO_DOMAIN is not configured');
      }

      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        scope: 'openid email profile',
        redirect_uri: redirectUri,
        identity_provider: 'Google',
      });

      return `https://${cognitoDomain}.auth.${this.config.aws.region}.amazoncognito.com/oauth2/authorize?${params.toString()}`;
    }

    /**
     * Exchanges the OAuth2 authorization code for tokens via Cognito
     * @param code - The authorization code from the callback
     * @param redirectUri - The same redirect URI used in the authorize request
     * @returns Promise<CognitoAuthResult> The tokens from Cognito
     */
    async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CognitoAuthResult> {
      return this.executeOperation(
        async () => {
          const cognitoDomain = this.config.aws.cognito.domain;
          const clientId = this.config.aws.cognito.clientId;
          const clientSecret = await this.getCognitoClientSecret();
          
          if (!cognitoDomain) {
            throw new Error('COGNITO_DOMAIN is not configured');
          }

          const tokenEndpoint = `${cognitoDomain}/oauth2/token`;
          
          const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: redirectUri,
          });

          const response = await axios.post(tokenEndpoint, params, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          });

          const tokens = response.data;
          
          if (!tokens.access_token || !tokens.id_token) {
            throw new Error('Invalid token response from Cognito');
          }

          return {
            accessToken: tokens.access_token,
            idToken: tokens.id_token,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expires_in,
            tokenType: tokens.token_type,
          };
        },
        'OAuth Token Exchange',
        { code: code.substring(0, 10) + '...' }
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