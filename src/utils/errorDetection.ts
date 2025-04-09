/**
 * Error detection and handling utilities
 */

import { toast } from "@/hooks/use-toast";

const MAX_ERROR_LIMIT = 5; // Maximum number of errors to track
const ERROR_RESET_INTERVAL = 60000; // Reset error counts every 60 seconds

interface ErrorEntry {
  timestamp: number;
  message: string;
}

// Error tracking
const errorCounts: number[] = [];
const errorLog: ErrorEntry[] = [];

/**
 * Log an error and track its frequency
 */
export function logError(message: string) {
  const now = Date.now();
  errorCounts.push(now);
  errorLog.push({ timestamp: now, message });
  
  // Remove old errors
  while (errorCounts.length > 0 && now - errorCounts[0] > ERROR_RESET_INTERVAL) {
    errorCounts.shift();
  }
  
  // Check if error limit has been reached
  if (errorCounts.length > MAX_ERROR_LIMIT) {
    const errorMessage = `Too many errors detected. System may be unstable. Last error: ${message}`;
    console.error(errorMessage);
    
    // Show toast notification
    toast({
      title: "Critical Error",
      description: errorMessage,
      variant: "destructive"
    });
    
    // Optionally, trigger a system reset or fallback mechanism
    // resetSystem();
  }
}

/**
 * Get recent errors
 */
export function getRecentErrors(timeWindow: number = 60000): ErrorEntry[] {
  const now = Date.now();
  return errorLog.filter(error => now - error.timestamp <= timeWindow);
}

/**
 * Clear error log
 */
export function clearErrorLog() {
  errorCounts.length = 0;
  errorLog.length = 0;
}

/**
 * Detect infinite loops based on repeated function calls
 */
const functionCallCounts: { [key: string]: number } = {};
const FUNCTION_CALL_THRESHOLD = 1000; // Threshold for loop detection
const LOOP_RESET_INTERVAL = 1000; // Reset loop counts every 1 second

/**
 * Track function calls and detect potential infinite loops
 */
export function trackFunctionCall(functionName: string) {
  if (!functionCallCounts[functionName]) {
    functionCallCounts[functionName] = 0;
  }
  
  functionCallCounts[functionName]++;
  
  // Check for loop condition
  if (functionCallCounts[functionName] > FUNCTION_CALL_THRESHOLD) {
    const message = `Infinite loop detected in function: ${functionName}`;
    console.error(message);
    
    // Show toast notification
    toast({
      title: "Loop Detected",
      description: message,
      variant: "destructive"
    });
    
    // Reset the count to prevent repeated alerts
    functionCallCounts[functionName] = 0;
  }
  
  // Reset counts periodically
  setTimeout(() => {
    if (functionCallCounts[functionName] > 0) {
      functionCallCounts[functionName] = Math.max(0, functionCallCounts[functionName] - 100);
    }
  }, LOOP_RESET_INTERVAL);
}

/**
 * Detect signal processing errors based on invalid values
 */
const INVALID_SIGNAL_THRESHOLD = 0.001; // Threshold for invalid signal detection
const INVALID_SIGNAL_COUNT_THRESHOLD = 5; // Number of invalid signals to trigger error
let invalidSignalCount = 0;

/**
 * Check for invalid signal values
 */
export function checkSignalValue(value: number) {
  if (isNaN(value) || Math.abs(value) < INVALID_SIGNAL_THRESHOLD) {
    invalidSignalCount++;
    
    if (invalidSignalCount > INVALID_SIGNAL_COUNT_THRESHOLD) {
      const message = "Invalid signal detected. Possible sensor malfunction.";
      console.warn(message);
      
      toast({
        title: "Signal Processing Error",
        description: message,
        variant: "destructive" // Changed from "warning" to "destructive"
      });
      
      invalidSignalCount = 0; // Reset counter
    }
  } else {
    invalidSignalCount = Math.max(0, invalidSignalCount - 1); // Reduce count if signal is valid
  }
}

/**
 * Detect low signal quality based on variance
 */
const LOW_QUALITY_VARIANCE_THRESHOLD = 0.0001; // Threshold for low variance
const LOW_QUALITY_COUNT_THRESHOLD = 3; // Number of low quality signals to trigger warning
let lowQualityCount = 0;

/**
 * Check for low signal quality based on variance
 */
export function checkSignalQuality(variance: number) {
  if (variance < LOW_QUALITY_VARIANCE_THRESHOLD) {
    lowQualityCount++;
    
    if (lowQualityCount > LOW_QUALITY_COUNT_THRESHOLD) {
      const message = "Signal quality is low. Check sensor connection.";
      console.warn(message);
      
      toast({
        title: "Warning",
        description: "Signal quality is low",
        variant: "default" // Changed from "warning" to "default"
      });
      
      lowQualityCount = 0; // Reset counter
    }
  } else {
    lowQualityCount = Math.max(0, lowQualityCount - 1); // Reduce count if signal is good
  }
}

/**
 * Detect excessive memory usage
 */
const MEMORY_USAGE_THRESHOLD = 500; // MB
let memoryCheckInterval: any;

/**
 * Start monitoring memory usage
 */
export function startMemoryMonitoring() {
  memoryCheckInterval = setInterval(() => {
    if (typeof window !== 'undefined' && window.performance && window.performance.memory) {
      const memoryUsage = window.performance.memory.usedJSHeapSize / (1024 * 1024); // in MB
      
      if (memoryUsage > MEMORY_USAGE_THRESHOLD) {
        const message = `Excessive memory usage detected: ${memoryUsage.toFixed(2)} MB`;
        console.warn(message);
        
        toast({
          title: "Memory Warning",
          description: message,
          variant: "destructive"
        });
        
        // Optionally, trigger garbage collection or reduce memory usage
        // collectGarbage();
      }
    }
  }, 5000); // Check every 5 seconds
}

/**
 * Stop monitoring memory usage
 */
export function stopMemoryMonitoring() {
  clearInterval(memoryCheckInterval);
}
