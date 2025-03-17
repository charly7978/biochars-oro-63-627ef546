
/**
 * Determines if a finger is present on the sensor
 */
export interface FingerDetectionResult {
  isFingerDetected: boolean;
  confidence: number;
}

export class FingerDetector {
  private readonly HISTORY_SIZE = 10;
  private readonly MIN_RED_THRESHOLD = 50; // Reduced for greater sensitivity (was 65)
  private readonly MAX_RED_THRESHOLD = 255; // Increased to maximum (was 250)
  private readonly WEAK_SIGNAL_THRESHOLD = 0.05; // Reduced for greater sensitivity (was 0.1)
  
  private consecutiveWeakSignals: number = 0;
  private readonly MAX_WEAK_SIGNALS = 5; // Increased tolerance (was 3)
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
    
    // Basic range check - more permissive
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
      this.consecutiveWeakSignals = Math.max(0, this.consecutiveWeakSignals - 1);
    }
    
    // Determine detection based on signal quality and weak signal history - more permissive
    const minQualityThreshold = 20; // Reduced for greater sensitivity (was 30)
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
    const confidence = historyConfidence * 0.6 + qualityFactor * 0.4; // Adjusted weights
    
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
