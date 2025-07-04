import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // OAuth callback is now handled entirely by the backend
    // If users land here, redirect them to login
    navigate('/login');
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">
          OAuth authentication is now handled by the backend.
        </p>
        <p className="mt-2 text-gray-500">
          Redirecting to login...
        </p>
      </div>
    </div>
  );
};