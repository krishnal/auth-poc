import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { User, AuthTokens, LoginCredentials, SignupData } from '../types/auth';
import { authService } from '../services/auth-service';
import { tokenStorage } from '../utils/token-storage';

interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { tokens: AuthTokens; user: User } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLEAR_ERROR' }
  | { type: 'TOKEN_REFRESHED'; payload: AuthTokens }
  | { type: 'USER_UPDATED'; payload: User }
  | { type: 'AUTH_CHECKED'; payload: { isAuthenticated: boolean; user?: User } };

const initialState: AuthState = {
  user: null,
  tokens: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true, error: null };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        tokens: action.payload.tokens,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        tokens: null,
        isLoading: false,
        isAuthenticated: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'TOKEN_REFRESHED':
      return { ...state, tokens: action.payload };
    case 'USER_UPDATED':
      return { ...state, user: action.payload };
    case 'AUTH_CHECKED':
      return {
        ...state,
        isAuthenticated: action.payload.isAuthenticated,
        user: action.payload.user || null,
        isLoading: false,
      };
    default:
      return state;
  }
};

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  clearError: () => void;
  checkAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const login = useCallback(async (credentials: LoginCredentials) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const tokens = await authService.login(credentials);
      tokenStorage.setTokens(tokens);
      const user = await authService.getCurrentUser();
      
      dispatch({ type: 'LOGIN_SUCCESS', payload: { tokens, user } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: message });
      throw error;
    }
  }, []);

  const signup = useCallback(async (data: SignupData) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      await authService.signup(data);
      // Note: After signup, user needs to verify email before login
      dispatch({ type: 'SET_LOADING', payload: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Signup failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: message });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Call backend logout endpoint
      await authService.logout();
      
      // Clear local tokens and update state
      tokenStorage.clearTokens();
      dispatch({ type: 'LOGOUT' });
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear local state even if server logout fails
      tokenStorage.clearTokens();
      dispatch({ type: 'LOGOUT' });
    }
  }, []);

  const refreshTokens = useCallback(async () => {
    const currentTokens = tokenStorage.getTokens();
    if (!currentTokens?.refreshToken) {
      logout();
      return;
    }

    try {
      const newTokens = await authService.refreshToken({
        refreshToken: currentTokens.refreshToken,
      });
      tokenStorage.setTokens(newTokens);
      dispatch({ type: 'TOKEN_REFRESHED', payload: newTokens });
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
    }
  }, [logout]);

  const updateUser = useCallback(async (userData: Partial<User>) => {
    try {
      const updatedUser = await authService.updateUserProfile(userData);
      dispatch({ type: 'USER_UPDATED', payload: updatedUser });
    } catch (error) {
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Check authentication status by calling a protected endpoint
  const checkAuthStatus = useCallback(async () => {
    try {
      // Try to get user profile from a protected endpoint
      const user = await authService.getCurrentUser();
      
      dispatch({ 
        type: 'AUTH_CHECKED', 
        payload: { 
          isAuthenticated: true, 
          user 
        } 
      });
    } catch (error) {
      // If the protected endpoint fails, user is not authenticated
      dispatch({ 
        type: 'AUTH_CHECKED', 
        payload: { 
          isAuthenticated: false 
        } 
      });
    }
  }, []);

  // Initialize auth state on app load
  useEffect(() => {
    const initAuth = async () => {
      // Check for existing tokens
      const tokens = tokenStorage.getTokens();
      if (tokens) {
        try {
          const user = await authService.getCurrentUser();
          dispatch({ type: 'LOGIN_SUCCESS', payload: { tokens, user } });
        } catch (error) {
          console.error('Failed to restore auth session:', error);
          tokenStorage.clearTokens();
          dispatch({ type: 'LOGOUT' });
        }
      } else {
        // No tokens found, user is not authenticated
        dispatch({ type: 'LOGOUT' });
      }
    };

    initAuth();
  }, []);

  // Auto token refresh
  useEffect(() => {
    if (!state.tokens || !state.isAuthenticated) return;

    const tokenRefreshInterval = setInterval(() => {
      const tokens = tokenStorage.getTokens();
      if (tokens) {
        // Refresh 5 minutes before expiration
        const timeUntilRefresh = (tokens.expiresIn - 300) * 1000;
        if (timeUntilRefresh <= 0) {
          refreshTokens();
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(tokenRefreshInterval);
  }, [state.tokens, state.isAuthenticated, refreshTokens]);

  const value: AuthContextType = {
    ...state,
    login,
    signup,
    logout,
    refreshTokens,
    updateUser,
    clearError,
    checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};