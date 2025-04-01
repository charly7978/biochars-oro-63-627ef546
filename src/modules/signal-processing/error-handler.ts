/**
 * Centralized error handling module for signal processing
 * Provides consistent error management across all modules
 */
import { ProcessingError, ErrorHandlerConfig } from '../../types/signal';

// Default error handler configuration
const DEFAULT_CONFIG: ErrorHandlerConfig = {
  logErrors: true,
  retryOnError: true,
  maxRetries: 3,
  notifyUser: false,
  fallbackToLastGoodValue: true
};

/**
 * Singleton error handler for signal processing
 */
export class SignalProcessingErrorHandler {
  private static instance: SignalProcessingErrorHandler;
  private config: ErrorHandlerConfig;
  private errorLog: ProcessingError[] = [];
  private lastGoodValues: Map<string, any> = new Map();
  private retryCount: Map<string, number> = new Map();
  private errorListeners: Array<(error: ProcessingError) => void> = [];

  private constructor(config?: Partial<ErrorHandlerConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    };
    console.log('Signal processing error handler initialized with config:', this.config);
  }

  /**
   * Get the singleton instance of the error handler
   */
  public static getInstance(config?: Partial<ErrorHandlerConfig>): SignalProcessingErrorHandler {
    if (!SignalProcessingErrorHandler.instance) {
      SignalProcessingErrorHandler.instance = new SignalProcessingErrorHandler(config);
    }
    return SignalProcessingErrorHandler.instance;
  }

  /**
   * Update the error handler configuration
   */
  public updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    console.log('Error handler config updated:', this.config);
  }

  /**
   * Handle a processing error
   * @returns Value to use (fallback value if available, otherwise null)
   */
  public handleError(error: ProcessingError, source: string, currentValue?: any): any {
    // 1. Log the error if configured to do so
    if (this.config.logErrors) {
      console.error(`[${source}] Processing error:`, error);
      this.errorLog.push({
        ...error,
        component: source,
        timestamp: Date.now()
      });
      
      // Only keep recent errors to prevent memory leaks
      if (this.errorLog.length > 100) {
        this.errorLog.shift();
      }
    }

    // 2. Notify listeners
    this.notifyErrorListeners({
      ...error,
      component: source,
      timestamp: Date.now()
    });

    // 3. Determine if we should retry
    const errorKey = `${source}:${error.code}`;
    const currentRetryCount = this.retryCount.get(errorKey) || 0;
    
    if (this.config.retryOnError && currentRetryCount < this.config.maxRetries) {
      this.retryCount.set(errorKey, currentRetryCount + 1);
      console.log(`Retry ${currentRetryCount + 1}/${this.config.maxRetries} for ${errorKey}`);
      // Signal that caller should retry
      return { shouldRetry: true, fallbackValue: this.lastGoodValues.get(source) };
    }
    
    // 4. Reset retry count if we've exceeded max retries
    if (currentRetryCount >= this.config.maxRetries) {
      this.retryCount.set(errorKey, 0);
    }

    // 5. Return fallback value if available and configured to do so
    if (this.config.fallbackToLastGoodValue) {
      const fallbackValue = this.lastGoodValues.get(source);
      if (fallbackValue !== undefined) {
        return { shouldRetry: false, fallbackValue };
      }
    }

    // No fallback available
    return { shouldRetry: false, fallbackValue: null };
  }

  /**
   * Register a valid processing result to use as fallback
   */
  public registerGoodValue(source: string, value: any): void {
    this.lastGoodValues.set(source, value);
  }

  /**
   * Add an error listener
   */
  public addErrorListener(listener: (error: ProcessingError) => void): void {
    this.errorListeners.push(listener);
  }

  /**
   * Remove an error listener
   */
  public removeErrorListener(listener: (error: ProcessingError) => void): void {
    this.errorListeners = this.errorListeners.filter(l => l !== listener);
  }

  /**
   * Get all recorded errors
   */
  public getErrors(): ProcessingError[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  public clearErrors(): void {
    this.errorLog = [];
    this.retryCount.clear();
  }

  /**
   * Notify all error listeners
   */
  private notifyErrorListeners(error: ProcessingError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });
  }
}

// Export factory function for easy access
export const getErrorHandler = (config?: Partial<ErrorHandlerConfig>) => 
  SignalProcessingErrorHandler.getInstance(config);
