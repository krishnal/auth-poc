import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { authService } from '../services/auth-service';

// Mock the auth service
jest.mock('../services/auth-service');

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

    (authService.login as jest.Mock).mockResolvedValue(mockTokens);
    (authService.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

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
    (authService.login as jest.Mock).mockRejectedValue(new Error('Invalid credentials'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    await userEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
    });
  });
});