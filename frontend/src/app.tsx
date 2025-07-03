import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LoginForm } from './components/LoginForm';
import { SignupForm } from './components/SignupForm';
import { ForgotPasswordForm } from './components/ForgotPasswordForm';
import { ResetPasswordForm } from './components/ResetPasswordForm';
import { AuthCallback } from './components/AuthCallback';
import { Dashboard } from './components/Dashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationProvider } from './contexts/NotificationContext';

function App() {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <AuthProvider>
          <Router>
            <div className="App">
              <Routes>
                <Route path="/login" element={<LoginForm />} />
                <Route path="/signup" element={<SignupForm />} />
                <Route path="/forgot-password" element={<ForgotPasswordForm />} />
                <Route path="/reset-password" element={<ResetPasswordForm />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </div>
          </Router>
        </AuthProvider>
      </NotificationProvider>
    </ErrorBoundary>
  );
}

export default App;