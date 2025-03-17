
/**
 * Determines if a finger is present on the sensor
 */
export interface FingerDetectionResult {
  isFingerDetected: boolean;
  confidence: number;
}

export class FingerDetector {
  private readonly HISTORY_SIZE = 15; // Increased history size
  private readonly MIN_RED_THRESHOLD = 70; // Lowered threshold for better sensitivity
  private readonly MAX_RED_THRESHOLD = 245;
  private readonly WEAK_SIGNAL_THRESHOLD = 0.12; // Lowered to be more sensitive
  
  private consecutiveWeakSignals: number = 0;
  private readonly MAX_WEAK_SIGNALS = 5; // Increased tolerance
  private detectionHistory: boolean[] = [];
  private qualityHistory: number[] = [];
  
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
    // Store signal quality
    this.updateQualityHistory(signalQuality);
    
    // Basic range check with more forgiving thresholds
    const isInRange = rawValue >= this.MIN_RED_THRESHOLD && 
                     rawValue <= this.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.updateHistory(false);
      return { 
        isFingerDetected: false, 
        confidence: 0 
      };
    }
    
    // Check for weak signal with more forgiving threshold
    const isWeakSignal = Math.abs(processedValue) < this.WEAK_SIGNAL_THRESHOLD;
    
    if (isWeakSignal) {
      this.consecutiveWeakSignals++;
    } else {
      this.consecutiveWeakSignals = Math.max(0, this.consecutiveWeakSignals - 1);
    }
    
    // Get average quality from history
    const avgQuality = this.getAverageQuality();
    
    // More forgiving quality threshold
    const minQualityThreshold = 25; // Lowered from 35
    
    // Consider both immediate and historical quality
    const isDetected = (signalQuality >= minQualityThreshold || avgQuality >= minQualityThreshold) && 
                      this.consecutiveWeakSignals < this.MAX_WEAK_SIGNALS;
    
    this.updateHistory(isDetected);
    
    // Calculate detection confidence
    const historyConfidence = this.calculateHistoryConfidence();
    const qualityFactor = signalQuality / 100;
    const confidence = historyConfidence * 0.6 + qualityFactor * 0.4;
    
    // Log detection details occasionally for debugging
    if (Math.random() < 0.05) {
      console.log("FingerDetector: Detection details", {
        rawValue,
        processedValue,
        signalQuality,
        avgQuality,
        historyConfidence,
        isWeakSignal,
        weakSignalCount: this.consecutiveWeakSignals,
        isDetected,
        confidence
      });
    }
    
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
  
  private updateQualityHistory(quality: number): void {
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > this.HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
  }
  
  private getAverageQuality(): number {
    if (this.qualityHistory.length === 0) return 0;
    
    // Calculate weighted average (more recent values have higher weight)
    let weightedSum = 0;
    let weightSum = 0;
    
    this.qualityHistory.forEach((quality, index) => {
      const weight = Math.pow(1.2, index);  // Exponential weight
      weightedSum += quality * weight;
      weightSum += weight;
    });
    
    return weightedSum / weightSum;
  }
  
  private calculateHistoryConfidence(): number {
    if (this.detectionHistory.length === 0) return 0;
    
    // Calculate weighted average (more recent values have higher weight)
    let weightedSum = 0;
    let weightSum = 0;
    
    this.detectionHistory.forEach((isDetected, index) => {
      const weight = Math.pow(1.15, index);  // Exponential weight
      weightedSum += (isDetected ? 1 : 0) * weight;
      weightSum += weight;
    });
    
    return weightedSum / weightSum;
  }
  
  /**
   * Reset the detector state
   */
  public reset(): void {
    this.detectionHistory = [];
    this.qualityHistory = [];
    this.consecutiveWeakSignals = 0;
  }
}
