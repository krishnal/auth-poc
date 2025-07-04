// backend/src/utils/response.ts
export interface ApiResponse<T = any> {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
  }
  
  export const createResponse = <T>(
    statusCode: number,
    data: T,
    headers: Record<string, string> = {}
  ): ApiResponse<T> => {
    const config = require('../config').getConfig();
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': config.cors.origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT',
        ...headers,
      },
      body: JSON.stringify(data),
    };
  };
  
  export const createErrorResponse = (
    statusCode: number,
    message: string,
    details?: any
  ): ApiResponse => {
    return createResponse(statusCode, {
      error: {
        message,
        details,
        timestamp: new Date().toISOString(),
      },
    });
  };
  
  export const createSuccessResponse = <T>(data: T): ApiResponse<T> => {
    return createResponse(200, { success: true, data });
  };