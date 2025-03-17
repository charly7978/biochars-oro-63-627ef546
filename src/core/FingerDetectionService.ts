
export interface ProcessedSignal {
  fingerDetected: boolean;
  quality: number;
  filteredValue: number;
  rawValue: number;
  timestamp: number;
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Simple service for finger detection
 */
export class FingerDetectionService {
  private lastSignal: ProcessedSignal | null = null;
  private detectionThreshold = 0.1;
  private qualityThreshold = 20;
  
  /**
   * Process a signal to detect if a finger is present
   */
  public processSignal(signal: ProcessedSignal): void {
    this.lastSignal = signal;
  }
  
  /**
   * Get the last processed signal
   */
  public getLastSignal(): ProcessedSignal | null {
    return this.lastSignal;
  }
  
  /**
   * Check if a finger is detected
   */
  public isFingerDetected(): boolean {
    if (!this.lastSignal) return false;
    return this.lastSignal.fingerDetected && this.lastSignal.quality > this.qualityThreshold;
  }
  
  /**
   * Get the current signal quality
   */
  public getSignalQuality(): number {
    if (!this.lastSignal) return 0;
    return this.lastSignal.quality;
  }
  
  /**
   * Reset the service
   */
  public reset(): void {
    this.lastSignal = null;
  }
}

// Export a singleton instance
export const fingerDetectionService = new FingerDetectionService();
