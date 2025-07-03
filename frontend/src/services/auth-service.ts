import { User, AuthTokens, LoginCredentials, SignupData, GoogleAuthData } from '../types/auth';
import { apiClient } from './api-client';

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    const response = await apiClient.post<AuthTokens>('/auth/login', credentials);
    return response.data;
  }

  async signup(data: SignupData): Promise<{ userSub: string; message: string }> {
    const response = await apiClient.post<{ userSub: string; message: string }>('/auth/signup', data);
    return response.data;
  }

  async authenticateWithGoogle(data: GoogleAuthData): Promise<AuthTokens> {
    console.log('data in authenticateWithGoogle', data);
    const response = await apiClient.post<AuthTokens>('/auth/google', data);
    console.log('response in authenticateWithGoogle', response);
    console.log('response in authenticateWithGoogle', response.data);
    return response.data;
  }

  async refreshToken(data: { refreshToken: string }): Promise<AuthTokens> {
    const response = await apiClient.post<AuthTokens>('/auth/refresh', data);
    return response.data;
  }

  async forgotPassword(email: string): Promise<void> {
    await apiClient.post<void>('/auth/password/forgot', { email });
  }

  async resetPassword(data: {
    email: string;
    confirmationCode: string;
    newPassword: string;
  }): Promise<void> {
    await apiClient.post<void>('/auth/password/reset', data);
  }

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>('/api/user');
    return response.data;
  }

  async updateUserProfile(userData: Partial<User>): Promise<User> {
    const response = await apiClient.put<User>('/api/user', userData);
    return response.data;
  }

  async getProtectedData(): Promise<any> {
    const response = await apiClient.get<any>('/api/data');
    return response.data;
  }
}

export const authService = new AuthService();