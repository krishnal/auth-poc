export interface User {
    id: string;
    email: string;
    givenName?: string;
    familyName?: string;
    emailVerified: boolean;
    createdAt: string;
    lastModified: string;
  }
  
  export interface AuthTokens {
    accessToken: string;
    idToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
  }
  
  export interface LoginCredentials {
    email: string;
    password: string;
  }
  
  export interface SignupData {
    email: string;
    password: string;
    givenName?: string;
    familyName?: string;
  }
  
