
/**
 * Determines if a finger is present on the sensor
 */
export interface FingerDetectionResult {
  isFingerDetected: boolean;
  confidence: number;
}

export class FingerDetector {
  private readonly HISTORY_SIZE = 10;
  private readonly MIN_RED_THRESHOLD = 30; // Significantly reduced for much greater sensitivity (was 50)
  private readonly MAX_RED_THRESHOLD = 255; // Maximum possible value
  private readonly WEAK_SIGNAL_THRESHOLD = 0.02; // Reduced for greater sensitivity (was 0.05)
  
  private consecutiveWeakSignals: number = 0;
  private readonly MAX_WEAK_SIGNALS = 8; // Increased tolerance (was 5)
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
    
    // Basic range check - much more permissive
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
    
    // Check for weak signal
    const isWeakSignal = Math.abs(processedValue) < this.WEAK_SIGNAL_THRESHOLD;
    
    if (isWeakSignal) {
      this.consecutiveWeakSignals++;
      console.log("FingerDetector: weak signal detected", { 
        consecutiveWeakSignals: this.consecutiveWeakSignals, 
        processedValue 
      });
    } else {
      this.consecutiveWeakSignals = Math.max(0, this.consecutiveWeakSignals - 2); // Faster recovery
    }
    
    // Determine detection based on signal quality and weak signal history - much more permissive
    const minQualityThreshold = 15; // Reduced for greater sensitivity (was 20)
    const isDetected = signalQuality >= minQualityThreshold && 
                     this.consecutiveWeakSignals < this.MAX_WEAK_SIGNALS;
    
    console.log("FingerDetector: detection decision", { 
      isDetected, 
      signalQuality, 
      minQualityThreshold,
      weakSignals: this.consecutiveWeakSignals
    });
    
    this.updateHistory(isDetected);
    
    // Calculate detection confidence
    const historyConfidence = this.calculateHistoryConfidence();
    const qualityFactor = signalQuality / 100;
    const confidence = historyConfidence * 0.5 + qualityFactor * 0.5; // Equal weights
    
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
