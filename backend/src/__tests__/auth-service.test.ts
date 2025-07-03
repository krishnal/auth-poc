import { AuthService } from '../services/auth-service';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

// Mock AWS SDK
jest.mock('@aws-sdk/client-cognito-identity-provider');

describe('AuthService', () => {
  let authService: AuthService;
  let mockCognitoClient: jest.Mocked<CognitoIdentityProviderClient>;

  beforeEach(() => {
    mockCognitoClient = {
      send: jest.fn(),
    } as any;
    
    authService = new AuthService();
    (authService as any).cognitoClient = mockCognitoClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockAuthResult = {
        AuthenticationResult: {
          AccessToken: 'mock-access-token',
          IdToken: 'mock-id-token',
          RefreshToken: 'mock-refresh-token',
          ExpiresIn: 3600,
          TokenType: 'Bearer',
        },
      };

      mockCognitoClient.send.mockResolvedValueOnce(mockAuthResult);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toEqual({
        AccessToken: 'mock-access-token',
        IdToken: 'mock-id-token',
        RefreshToken: 'mock-refresh-token',
        ExpiresIn: 3600,
        TokenType: 'Bearer',
      });

      expect(mockCognitoClient.send).toHaveBeenCalledTimes(1);
    });

    it('should throw error for invalid credentials', async () => {
      mockCognitoClient.send.mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('signup', () => {
    it('should successfully create user account', async () => {
      const mockSignupResult = {
        UserSub: 'mock-user-id',
      };

      mockCognitoClient.send.mockResolvedValueOnce(mockSignupResult);

      const result = await authService.signup({
        email: 'newuser@example.com',
        password: 'password123',
        givenName: 'John',
        familyName: 'Doe',
      });

      expect(result).toEqual({
        userSub: 'mock-user-id',
        message: 'User created successfully. Please check your email for verification.',
      });
    });
  });
});