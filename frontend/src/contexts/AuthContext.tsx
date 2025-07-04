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
  authMethod: 'token' | 'cookie' | null; // Track authentication method
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { tokens?: AuthTokens; user: User; authMethod: 'token' | 'cookie' } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLEAR_ERROR' }
  | { type: 'TOKEN_REFRESHED'; payload: AuthTokens }
  | { type: 'USER_UPDATED'; payload: User }
  | { type: 'AUTH_CHECKED'; payload: { isAuthenticated: boolean; user?: User; authMethod?: 'token' | 'cookie' } };

const initialState: AuthState = {
  user: null,
  tokens: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
  authMethod: null,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true, error: null };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        tokens: action.payload.tokens || null,
        isLoading: false,
        isAuthenticated: true,
        error: null,
        authMethod: action.payload.authMethod,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        tokens: null,
        isLoading: false,
        isAuthenticated: false,
        error: action.payload,
        authMethod: null,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        tokens: null,
        isAuthenticated: false,
        error: null,
        authMethod: null,
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
        authMethod: action.payload.authMethod || null,
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
      
      dispatch({ type: 'LOGIN_SUCCESS', payload: { tokens, user, authMethod: 'token' } });
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
      // Call backend logout endpoint to clear HTTP-only cookies
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
      // This works for both token-based and cookie-based auth
      const user = await authService.getCurrentUser();
      
      // Check if we have tokens in localStorage (token-based auth)
      const tokens = tokenStorage.getTokens();
      const authMethod = tokens ? 'token' : 'cookie';
      
      dispatch({ 
        type: 'AUTH_CHECKED', 
        payload: { 
          isAuthenticated: true, 
          user, 
          authMethod 
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
      // Check for existing tokens first (email/password auth)
      const tokens = tokenStorage.getTokens();
      if (tokens) {
        try {
          const user = await authService.getCurrentUser();
          dispatch({ type: 'LOGIN_SUCCESS', payload: { tokens, user, authMethod: 'token' } });
        } catch (error) {
          console.error('Failed to restore token-based auth session:', error);
          tokenStorage.clearTokens();
          // Still check for cookie-based auth
          await checkAuthStatus();
        }
      } else {
        // No tokens, check for cookie-based auth (Google OAuth)
        await checkAuthStatus();
      }
    };

    initAuth();
  }, [checkAuthStatus]);

  // Auto token refresh (only for token-based auth)
  useEffect(() => {
    if (!state.tokens || !state.isAuthenticated || state.authMethod !== 'token') return;

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
  }, [state.tokens, state.isAuthenticated, state.authMethod, refreshTokens]);

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