import { FastifyInstance } from 'fastify';
import { AuthService } from '../services/auth-service';
import { Logger } from '../utils/logger';
import { createErrorResponse, createSuccessResponse } from '../utils/response';
import { extractErrorMessage } from '../utils/errors';
import {
  LoginRequest,
  SignupRequest,
  RefreshTokenRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../types/auth';

/**
 * Authentication routes
 */
export function registerAuthRoutes(app: FastifyInstance): void {
  const authService = new AuthService();

  // Register all auth routes under /auth prefix
  app.register(async (fastify) => {
    // Login with email/password
    fastify.post<{ Body: LoginRequest }>('/auth/login', async (request, reply) => {
      const logger = new Logger({ action: 'login', email: request.body.email });
      
      try {
        logger.info('Login attempt started');
        
        const result = await authService.login(request.body);
        
        logger.info('Login successful');
        return createSuccessResponse(result);
      } catch (error) {
        logger.error('Login failed', error);
        reply.code(401);
        return createErrorResponse(401, 'Invalid credentials');
      }
    });

    // Signup with email/password
    fastify.post<{ Body: SignupRequest }>('/auth/signup', async (request, reply) => {
      const logger = new Logger({ action: 'signup', email: request.body.email });
      
      try {
        logger.info('Signup attempt started');
        
        const result = await authService.signup(request.body);
        
        logger.info('Signup successful');
        return createSuccessResponse(result);
      } catch (error) {
        logger.error('Signup failed', error);
        reply.code(400);
        return createErrorResponse(400, extractErrorMessage(error, 'Signup failed'));
      }
    });

    // Google OAuth redirect (new federated approach)
    fastify.get('/auth/google', async (request, reply) => {
      const logger = new Logger({ action: 'google-oauth-redirect' });
      
      try {
        logger.info('Google OAuth redirect started');
        
        const redirectUri = `${request.protocol}://${request.hostname}${request.hostname === 'localhost' ? ':3001' : ''}/auth/callback`;
        const authUrl = authService.getGoogleAuthUrl(redirectUri);
        
        logger.info('Redirecting to Cognito OAuth2 authorize URL', { redirectUri });
        return reply.redirect(authUrl);
      } catch (error) {
        logger.error('Google OAuth redirect failed', error);
        reply.code(400);
        return createErrorResponse(400, extractErrorMessage(error, 'Google OAuth redirect failed'));
      }
    });



    // OAuth callback endpoint
    fastify.get('/auth/callback', async (request, reply) => {
      const logger = new Logger({ action: 'oauth-callback' });
      
      try {
        logger.info('OAuth callback received');
        
        const { code, error } = request.query as { code?: string; error?: string };
        
        if (error) {
          logger.error('OAuth callback error', { error });
          return reply.redirect(`http://localhost:3000/login?error=${encodeURIComponent(error)}`);
        }
        
        if (!code) {
          logger.error('OAuth callback missing code');
          return reply.redirect('http://localhost:3000/login?error=missing_code');
        }
        
        const redirectUri = `${request.protocol}://${request.hostname}${request.hostname === 'localhost' ? ':3001' : ''}/auth/callback`;
        const tokens = await authService.exchangeCodeForTokens(code, redirectUri);
        
        logger.info('OAuth token exchange successful');
        
        // Set tokens in secure HTTP-only cookies
        reply.setCookie('access_token', tokens.accessToken, {
          httpOnly: true,
          secure: request.protocol === 'https',
          sameSite: 'lax',
          maxAge: tokens.expiresIn,
          path: '/',
        });
        
        reply.setCookie('id_token', tokens.idToken, {
          httpOnly: true,
          secure: request.protocol === 'https',
          sameSite: 'lax',
          maxAge: tokens.expiresIn,
          path: '/',
        });
        
        if (tokens.refreshToken) {
          reply.setCookie('refresh_token', tokens.refreshToken, {
            httpOnly: true,
            secure: request.protocol === 'https',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60, // 30 days
            path: '/',
          });
        }
        
        // Redirect to dashboard
        return reply.redirect('http://localhost:3000/dashboard');
      } catch (error) {
        logger.error('OAuth callback failed', error);
        return reply.redirect(`http://localhost:3000/login?error=${encodeURIComponent('oauth_callback_failed')}`);
      }
    });

    // Refresh token
    fastify.post<{ Body: RefreshTokenRequest }>('/auth/refresh', async (request, reply) => {
      const logger = new Logger({ action: 'refresh-token' });
      
      try {
        logger.info('Token refresh attempt started');
        
        const result = await authService.refreshToken(request.body);
        
        logger.info('Token refresh successful');
        return createSuccessResponse(result);
      } catch (error) {
        logger.error('Token refresh failed', error);
        reply.code(401);
        return createErrorResponse(401, 'Invalid refresh token');
      }
    });

    // Forgot password
    fastify.post<{ Body: ForgotPasswordRequest }>('/auth/password/forgot', async (request, reply) => {
      const logger = new Logger({ action: 'forgot-password', email: request.body.email });
      
      try {
        logger.info('Forgot password attempt started');
        
        await authService.forgotPassword(request.body);
        
        logger.info('Forgot password email sent');
        return createSuccessResponse({ message: 'Reset code sent to email' });
      } catch (error) {
        logger.error('Forgot password failed', error);
        reply.code(400);
        return createErrorResponse(400, extractErrorMessage(error, 'Failed to send reset code'));
      }
    });

    // Reset password
    fastify.post<{ Body: ResetPasswordRequest }>('/auth/password/reset', async (request, reply) => {
      const logger = new Logger({ action: 'reset-password', email: request.body.email });
      
      try {
        logger.info('Password reset attempt started');
        
        await authService.resetPassword(request.body);
        
        logger.info('Password reset successful');
        return createSuccessResponse({ message: 'Password reset successful' });
      } catch (error) {
        logger.error('Password reset failed', error);
        reply.code(400);
        return createErrorResponse(400, extractErrorMessage(error, 'Password reset failed'));
      }
    });

    // Logout endpoint to clear cookies
    fastify.get('/auth/logout', async (request, reply) => {
      const logger = new Logger({ action: 'logout' });
      
      try {
        logger.info('Logout attempt started');
        
        // Clear all authentication cookies
        reply.clearCookie('access_token', { path: '/' });
        reply.clearCookie('id_token', { path: '/' });
        reply.clearCookie('refresh_token', { path: '/' });
        
        logger.info('Logout successful');
        return createSuccessResponse({ message: 'Logout successful' });
      } catch (error) {
        logger.error('Logout failed', error);
        reply.code(400);
        return createErrorResponse(400, 'Logout failed');
      }
    });
  });
} 