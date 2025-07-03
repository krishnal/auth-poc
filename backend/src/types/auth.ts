// backend/src/types/auth.ts
export interface CognitoAuthResult {
    accessToken: string;
    idToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
  }
  
  export interface LoginRequest {
    email: string;
    password: string;
  }
  
  export interface SignupRequest {
    email: string;
    password: string;
    givenName?: string;
    familyName?: string;
  }
  
  export interface GoogleAuthRequest {
    code: string;
    redirectUri: string;
  }
  
  export interface RefreshTokenRequest {
    refreshToken: string;
  }
  
  export interface ForgotPasswordRequest {
    email: string;
  }
  
  export interface ResetPasswordRequest {
    email: string;
    confirmationCode: string;
    newPassword: string;
  }