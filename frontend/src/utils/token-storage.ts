import { AuthTokens } from '../types/auth';

const TOKEN_KEY = 'auth_tokens';

class TokenStorage {
  setTokens(tokens: AuthTokens): void {
    try {
      const tokenData = {
        ...tokens,
        timestamp: Date.now(),
      };
      localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
    } catch (error) {
      console.error('Failed to store tokens:', error);
    }
  }

  getTokens(): AuthTokens | null {
    try {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (!stored) return null;

      const tokenData = JSON.parse(stored);
      
      // Check if tokens are expired
      const now = Date.now();
      const tokenAge = (now - tokenData.timestamp) / 1000; // in seconds
      
      if (tokenAge > tokenData.expiresIn) {
        this.clearTokens();
        return null;
      }

      return {
        accessToken: tokenData.accessToken,
        idToken: tokenData.idToken,
        refreshToken: tokenData.refreshToken,
        expiresIn: tokenData.expiresIn,
        tokenType: tokenData.tokenType,
      };
    } catch (error) {
      console.error('Failed to retrieve tokens:', error);
      this.clearTokens();
      return null;
    }
  }

  clearTokens(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }
}

export const tokenStorage = new TokenStorage();