
/**
 * Interface for PPG data point with timestamp
 */
export interface PPGDataPoint {
  timestamp: number;
  value: number;
  time: number; // Required for backward compatibility
  [key: string]: any;
}

/**
 * Interface for standardized PPG data across the system
 */
export interface TimestampedPPGData {
  timestamp: number;
  value: number;
  time?: number; // Optional for new implementations
  [key: string]: any;
}
