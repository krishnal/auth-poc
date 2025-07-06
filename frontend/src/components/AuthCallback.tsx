import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { tokenStorage } from '../utils/token-storage';

export const AuthCallback: React.FC = () => {
  const { checkAuthStatus } = useAuth();
  const location = useLocation();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processOAuthCallback = async () => {
      try {
        // Extract tokens from URL parameters
        const params = new URLSearchParams(location.search);
        const accessToken = params.get('access_token');
        const idToken = params.get('id_token');
        const refreshToken = params.get('refresh_token');
        const expiresIn = params.get('expires_in');
        const tokenType = params.get('token_type');
        
        if (!accessToken || !idToken || !refreshToken || !expiresIn) {
          throw new Error('Missing required tokens from OAuth callback');
        }
        
        // Store tokens using the same format as login
        const tokens = {
          accessToken,
          idToken,
          refreshToken,
          expiresIn: parseInt(expiresIn),
          tokenType: tokenType || 'Bearer',
        };
        
        tokenStorage.setTokens(tokens);
        
        // Check auth status to populate user context
        await checkAuthStatus();
        
        setIsProcessing(false);
      } catch (error) {
        console.error('OAuth callback error:', error);
        setError(error instanceof Error ? error.message : 'OAuth callback failed');
        setIsProcessing(false);
      }
    };

    processOAuthCallback();
  }, [location, checkAuthStatus]);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Processing authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <Navigate to="/login" state={{ error }} replace />;
  }

  return <Navigate to="/dashboard" replace />;
};