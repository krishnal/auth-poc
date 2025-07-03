export interface LogContext {
    requestId?: string;
    userId?: string;
    email?: string;
    action?: string;
    [key: string]: any;
  }
  
  export class Logger {
    private context: LogContext;
  
    constructor(context: LogContext = {}) {
      this.context = context;
    }
  
    private log(level: string, message: string, data?: any) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context: this.context,
        data,
      };
  
      console.log(JSON.stringify(logEntry));
    }
  
    info(message: string, data?: any) {
      this.log('INFO', message, data);
    }
  
    error(message: string, error?: Error | any) {
      this.log('ERROR', message, {
        error: error?.message || error,
        stack: error?.stack,
      });
    }
  
    warn(message: string, data?: any) {
      this.log('WARN', message, data);
    }
  
    debug(message: string, data?: any) {
      this.log('DEBUG', message, data);
    }
  
    withContext(additionalContext: LogContext): Logger {
      return new Logger({ ...this.context, ...additionalContext });
    }
  }