import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

export const AuthCallback: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      navigate('/login?error=oauth_failed');
      return;
    }

    if (code) {
      // Prevent double-processing in React.StrictMode by marking the code as used
      const storageKey = `oauth_code_${code}`;
      if (sessionStorage.getItem(storageKey)) {
        console.log('OAuth code already processed, skipping');
        return;
      }
      
      sessionStorage.setItem(storageKey, 'used');
      
      loginWithGoogle(code)
        .then(() => {
          navigate('/dashboard');
        })
        .catch((error) => {
          console.error('Google login failed:', error);
          // Remove the storage marker if login failed so it can be retried
          sessionStorage.removeItem(storageKey);
          navigate('/login?error=oauth_failed');
        });
    } else {
      navigate('/login');
    }
  }, [location, loginWithGoogle, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
};