
/**
 * Error handling utilities for signal processing
 * Extracted from SignalProcessor for better maintainability
 */
import { ProcessingError } from '../../types/signal';

/**
 * Format and handle signal processing errors
 */
export function handleSignalProcessingError(
  code: string, 
  message: string,
  onError?: (error: ProcessingError) => void
): void {
  console.error("PPGSignalProcessor: Error", code, message);
  
  const error: ProcessingError = {
    code,
    message,
    timestamp: Date.now()
  };
  
  onError?.(error);
}
