import { tokenStorage } from '../utils/token-storage';

interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: {
    message: string;
    details?: any;
    timestamp: string;
  };
}

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const tokens = tokenStorage.getTokens();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add Authorization header if we have tokens (token-based auth)
    if (tokens?.accessToken) {
      headers.Authorization = `Bearer ${tokens.accessToken}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include', // Include cookies for cookie-based auth
    };

    try {
      const response = await fetch(url, config);
      
      // Handle different response types
      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // For non-JSON responses (like redirects), create a simple response
        data = { success: response.ok, data: null };
      }

      if (!response.ok) {
        // Handle error responses
        if (data.error) {
          throw new Error(data.error.message || `HTTP ${response.status}`);
        } else if (data.body && typeof data.body === 'string') {
          // Handle wrapped error responses
          try {
            const parsedBody = JSON.parse(data.body);
            if (parsedBody.error) {
              throw new Error(parsedBody.error.message || `HTTP ${response.status}`);
            }
          } catch (parseError) {
            // If parsing fails, use the original error
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }

      // Handle successful responses
      // Check if response is already in the correct format
      if (data.success !== undefined && data.data !== undefined) {
        return data;
      }
      
      // Handle wrapped responses (from Lambda)
      if (data.body && typeof data.body === 'string') {
        try {
          const parsedBody = JSON.parse(data.body);
          if (parsedBody.success !== undefined && parsedBody.data !== undefined) {
            return parsedBody;
          }
          // If parsed body doesn't have expected structure, wrap it
          return { success: true, data: parsedBody };
        } catch (parseError) {
          // If parsing fails, wrap the original response
          return { success: true, data: data.body };
        }
      }
      
      // For direct responses without wrapper
      return { success: true, data };
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const options: RequestInit = {
      method: 'POST',
    };
    
    // If we have data, set body and let default Content-Type apply
    if (data) {
      options.body = JSON.stringify(data);
    } else {
      // If no data, don't set Content-Type to avoid Fastify error
      options.headers = {};
    }
    
    return this.request<T>(endpoint, options);
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();