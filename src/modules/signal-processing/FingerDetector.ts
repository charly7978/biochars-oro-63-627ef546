
/**
 * Determines if a finger is present on the sensor
 */
export interface FingerDetectionResult {
  isFingerDetected: boolean;
  confidence: number;
}

export class FingerDetector {
  private readonly HISTORY_SIZE = 10;
  private readonly MIN_RED_THRESHOLD = 85;
  private readonly MAX_RED_THRESHOLD = 245;
  private readonly WEAK_SIGNAL_THRESHOLD = 0.15;
  
  private consecutiveWeakSignals: number = 0;
  private readonly MAX_WEAK_SIGNALS = 3;
  private detectionHistory: boolean[] = [];
  
  /**
   * Detects if a finger is present based on signal characteristics
   * @param rawValue - The raw red channel value
   * @param processedValue - The processed signal value
   * @param signalQuality - The calculated signal quality
   * @returns Detection result with confidence
   */
  public detectFinger(
    rawValue: number, 
    processedValue: number,
    signalQuality: number
  ): FingerDetectionResult {
    // Basic range check
    const isInRange = rawValue >= this.MIN_RED_THRESHOLD && 
                     rawValue <= this.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.updateHistory(false);
      return { 
        isFingerDetected: false, 
        confidence: 0 
      };
    }
    
    // Check for weak signal
    const isWeakSignal = Math.abs(processedValue) < this.WEAK_SIGNAL_THRESHOLD;
    
    if (isWeakSignal) {
      this.consecutiveWeakSignals++;
    } else {
      this.consecutiveWeakSignals = Math.max(0, this.consecutiveWeakSignals - 1);
    }
    
    // Determine detection based on signal quality and weak signal history
    const minQualityThreshold = 35;
    const isDetected = signalQuality >= minQualityThreshold && 
                     this.consecutiveWeakSignals < this.MAX_WEAK_SIGNALS;
    
    this.updateHistory(isDetected);
    
    // Calculate detection confidence
    const historyConfidence = this.calculateHistoryConfidence();
    const qualityFactor = signalQuality / 100;
    const confidence = historyConfidence * 0.7 + qualityFactor * 0.3;
    
    return {
      isFingerDetected: isDetected,
      confidence: confidence
    };
  }
  
  private updateHistory(isDetected: boolean): void {
    this.detectionHistory.push(isDetected);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
  }
  
  private calculateHistoryConfidence(): number {
    if (this.detectionHistory.length === 0) return 0;
    
    const trueCount = this.detectionHistory.filter(v => v).length;
    return trueCount / this.detectionHistory.length;
  }
  
  /**
   * Reset the detector state
   */
  public reset(): void {
    this.detectionHistory = [];
    this.consecutiveWeakSignals = 0;
  }
}
