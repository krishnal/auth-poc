import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';
import { AuthProvider } from '../contexts/AuthContext';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('LoginForm', () => {
  it('should render login form', () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should show validation errors for empty fields', async () => {
    renderWithProviders(<LoginForm />);

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await userEvent.click(submitButton);

    // Form should not submit with empty fields (HTML5 validation)
    expect(screen.getByLabelText(/email address/i)).toBeInvalid();
  });

  it('should toggle password visibility', async () => {
    renderWithProviders(<LoginForm />);

    const passwordInput = screen.getByLabelText(/password/i);
    const toggleButton = screen.getByRole('button', { name: /👁️‍🗨️/ });

    expect(passwordInput).toHaveAttribute('type', 'password');

    await userEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    await userEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});