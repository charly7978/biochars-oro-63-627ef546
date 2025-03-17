
/**
 * Enhanced FingerDetector for reliable finger detection
 */
export class FingerDetector {
  private readonly HISTORY_SIZE = 15;
  private readonly DETECTION_THRESHOLD = 25; // Lower threshold for better sensitivity
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.25; 
  private readonly CONFIDENCE_INCREASE_RATE = 0.15;
  private readonly CONFIDENCE_DECREASE_RATE = 0.08;
  
  private brightnessHistory: number[] = [];
  private detectionHistory: boolean[] = [];
  private consecutiveDetections = 0;
  private detectionConfidence = 0;
  private lastDetectionTime = 0;
  
  /**
   * Detect if a finger is covering the camera
   */
  public detectFinger(rawValue: number, filteredValue: number, quality: number): { 
    isFingerDetected: boolean; 
    confidence: number;
  } {
    const now = Date.now();
    
    // Track brightness history
    this.brightnessHistory.push(rawValue);
    if (this.brightnessHistory.length > this.HISTORY_SIZE) {
      this.brightnessHistory.shift();
    }
    
    // Basic detection - red channel value above threshold
    const basicDetection = rawValue > this.DETECTION_THRESHOLD;
    
    // Track detection history
    this.detectionHistory.push(basicDetection);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    // Calculate detection ratio
    const detectionRatio = this.detectionHistory.filter(d => d).length / Math.max(1, this.detectionHistory.length);
    
    // Update confidence with stabilization
    if (basicDetection) {
      this.consecutiveDetections = Math.min(this.HISTORY_SIZE, this.consecutiveDetections + 1);
      this.detectionConfidence = Math.min(1.0, this.detectionConfidence + this.CONFIDENCE_INCREASE_RATE);
    } else {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
      this.detectionConfidence = Math.max(0, this.detectionConfidence - this.CONFIDENCE_DECREASE_RATE);
    }
    
    // Final detection decision with confidence
    const isFingerDetected = this.detectionConfidence >= this.MIN_CONFIDENCE_THRESHOLD;
    
    // Log periodically to avoid flooding
    if (now - this.lastDetectionTime > 1000) {  // Log once per second max
      this.lastDetectionTime = now;
      console.log("FingerDetector: Detection result", {
        rawValue,
        isFingerDetected,
        confidence: this.detectionConfidence.toFixed(2),
        threshold: this.DETECTION_THRESHOLD,
        quality: quality.toFixed(0),
        timestamp: new Date().toISOString()
      });
    }
    
    return {
      isFingerDetected,
      confidence: this.detectionConfidence
    };
  }
  
  /**
   * Reset the detector
   */
  public reset(): void {
    this.brightnessHistory = [];
    this.detectionHistory = [];
    this.consecutiveDetections = 0;
    this.detectionConfidence = 0;
    console.log("FingerDetector: Reset complete");
  }
}
