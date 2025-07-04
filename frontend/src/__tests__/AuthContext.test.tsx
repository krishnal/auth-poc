import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { authService } from '../services/auth-service';
import { apiClient } from '../services/api-client';
import { tokenStorage } from '../utils/token-storage';

// Mock fetch globally
global.fetch = jest.fn();

// Jest mocks with inline definitions to avoid hoisting issues
jest.mock('../services/auth-service', () => ({
  authService: {
    login: jest.fn(),
    signup: jest.fn(),
    authenticateWithGoogle: jest.fn(),
    refreshToken: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    getCurrentUser: jest.fn(),
    updateUserProfile: jest.fn(),
    getProtectedData: jest.fn(),
  },
}));

jest.mock('../services/api-client', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../utils/token-storage', () => ({
  tokenStorage: {
    setTokens: jest.fn(),
    getTokens: jest.fn().mockReturnValue(null),
    clearTokens: jest.fn(),
  },
}));

// Cast to mocked types
const mockedAuthService = authService as jest.Mocked<typeof authService>;
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockedTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;

const TestComponent = () => {
  const { user, login, logout, isLoading, error } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{isLoading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="user">{user ? user.email : 'No User'}</div>
      <div data-testid="error">{error || 'No Error'}</div>
      <button onClick={() => login({ email: 'test@example.com', password: 'password' })}>
        Login
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Reset all mocks
    (global.fetch as jest.Mock).mockClear();
    mockedApiClient.post.mockClear();
    mockedApiClient.get.mockClear();
    mockedAuthService.login.mockClear();
    mockedAuthService.getCurrentUser.mockClear();
    mockedTokenStorage.getTokens.mockReturnValue(null);
  });

  it('should provide initial state', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('user')).toHaveTextContent('No User');
    expect(screen.getByTestId('error')).toHaveTextContent('No Error');
  });

  it('should handle successful login', async () => {
    const mockTokens = {
      accessToken: 'access-token',
      idToken: 'id-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      emailVerified: true,
      createdAt: '2023-01-01',
      lastModified: '2023-01-01',
    };

    // Mock the auth service methods
    mockedAuthService.login.mockResolvedValueOnce(mockTokens);
    mockedAuthService.getCurrentUser.mockResolvedValueOnce(mockUser);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    await userEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });
  });

  it('should handle login failure', async () => {
    // Mock the auth service to reject with a string - this will trigger the fallback error message
    mockedAuthService.login.mockRejectedValue('Invalid credentials');

    const TestLoginComponent = () => {
      const { error, login } = useAuth();
      
      React.useEffect(() => {
        // Call login directly and catch the error
        const performLogin = async () => {
          try {
            await login({ email: 'test@example.com', password: 'password' });
          } catch (error) {
            // Expected to throw since AuthContext rethrows errors
          }
        };
        performLogin();
      }, [login]);

      return <div data-testid="error">{error || 'No Error'}</div>;
    };

    render(
      <AuthProvider>
        <TestLoginComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      // When error is not an Error instance, AuthContext shows 'Login failed'
      expect(screen.getByTestId('error')).toHaveTextContent('Login failed');
    });
  });
});