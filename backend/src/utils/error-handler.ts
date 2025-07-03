/**
 * Safely extracts an error message from an unknown error type
 * @param error - The caught error (typed as unknown)
 * @param defaultMessage - Default message if error message cannot be extracted
 * @returns A string error message
 */
export function getErrorMessage(error: unknown, defaultMessage: string = 'An error occurred'): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  
  return defaultMessage;
}

/**
 * Type guard to check if an unknown value is an Error instance
 * @param error - The value to check
 * @returns True if the value is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
} 