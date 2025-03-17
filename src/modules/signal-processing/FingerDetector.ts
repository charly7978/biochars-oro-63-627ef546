
/**
 * Determines if a finger is present on the sensor
 */
export interface FingerDetectionResult {
  isFingerDetected: boolean;
  confidence: number;
}

export class FingerDetector {
  private readonly HISTORY_SIZE = 5; // Reduced for faster detection
  private readonly MIN_RED_THRESHOLD = 10; // Extreme reduction for any detection
  private readonly MAX_RED_THRESHOLD = 255; // Maximum possible value
  private readonly WEAK_SIGNAL_THRESHOLD = 0.001; // Extremely sensitive
  
  private consecutiveWeakSignals: number = 0;
  private readonly MAX_WEAK_SIGNALS = 10; // Very high tolerance
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
    console.log("FingerDetector: analyzing values", { 
      rawValue, 
      processedValue, 
      signalQuality, 
      thresholds: {
        min: this.MIN_RED_THRESHOLD,
        max: this.MAX_RED_THRESHOLD,
        weak: this.WEAK_SIGNAL_THRESHOLD
      }
    });
    
    // Basic range check - EXTREMELY permissive
    const isInRange = rawValue >= this.MIN_RED_THRESHOLD && 
                     rawValue <= this.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      console.log("FingerDetector: value out of range", { rawValue, isInRange });
      this.updateHistory(false);
      return { 
        isFingerDetected: false, 
        confidence: 0 
      };
    }
    
    // Check for weak signal - VERY forgiving
    const isWeakSignal = Math.abs(processedValue) < this.WEAK_SIGNAL_THRESHOLD;
    
    if (isWeakSignal) {
      this.consecutiveWeakSignals++;
      console.log("FingerDetector: weak signal detected", { 
        consecutiveWeakSignals: this.consecutiveWeakSignals, 
        processedValue 
      });
    } else {
      this.consecutiveWeakSignals = 0; // Reset immediately on any strong signal
    }
    
    // Determine detection based on signal quality and weak signal history
    // EXTREMELY permissive - almost any signal will be detected
    const minQualityThreshold = 5; // Significantly reduced threshold
    const isDetected = signalQuality >= minQualityThreshold || 
                      rawValue > this.MIN_RED_THRESHOLD * 2;
    
    console.log("FingerDetector: detection decision", { 
      isDetected, 
      signalQuality, 
      minQualityThreshold,
      weakSignals: this.consecutiveWeakSignals
    });
    
    this.updateHistory(isDetected);
    
    // Calculate detection confidence - highly optimistic
    const historyConfidence = this.calculateHistoryConfidence();
    const qualityFactor = signalQuality / 100;
    const confidence = Math.max(historyConfidence * 0.3 + qualityFactor * 0.3 + 0.4, 0.5);
    
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
    console.log("FingerDetector: Reset complete");
  }
}
