
/**
 * Enhanced FingerDetector with much higher sensitivity for detecting fingers covering the camera
 */
export class FingerDetector {
  private readonly HISTORY_SIZE = 10;
  private readonly DETECTION_THRESHOLD = 30; // Very low threshold for better detection
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.3; // Low confidence threshold
  
  private brightnessHistory: number[] = [];
  private detectionHistory: boolean[] = [];
  private consecutiveDetections = 0;
  private detectionConfidence = 0;
  
  /**
   * Detect if a finger is covering the camera with very high sensitivity
   */
  public detectFinger(rawValue: number, filteredValue: number, quality: number): { 
    isFingerDetected: boolean; 
    confidence: number;
  } {
    // Track brightness history
    this.brightnessHistory.push(rawValue);
    if (this.brightnessHistory.length > this.HISTORY_SIZE) {
      this.brightnessHistory.shift();
    }
    
    // Very simple initial detection - ANY red channel value indicates finger presence
    let isFingerDetected = rawValue > this.DETECTION_THRESHOLD;
    
    // Track detection history
    this.detectionHistory.push(isFingerDetected);
    if (this.detectionHistory.length > this.HISTORY_SIZE) {
      this.detectionHistory.shift();
    }
    
    // Calculate detection confidence
    const detectionRatio = this.detectionHistory.filter(d => d).length / this.detectionHistory.length;
    
    // Update confidence with stabilization
    if (isFingerDetected) {
      this.consecutiveDetections = Math.min(10, this.consecutiveDetections + 1);
      this.detectionConfidence = Math.min(1.0, this.detectionConfidence + 0.1);
    } else {
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
      this.detectionConfidence = Math.max(0, this.detectionConfidence - 0.05);
    }
    
    // Final detection decision, biased toward positive detection
    const finalDetection = 
      this.detectionConfidence >= this.MIN_CONFIDENCE_THRESHOLD || 
      this.consecutiveDetections >= 2;
    
    // Include some debug logging
    if (Math.random() < 0.05) {  // Log ~5% of the time to avoid flooding
      console.log("FingerDetector: Detection result", {
        rawValue,
        isFingerDetected: finalDetection,
        confidence: this.detectionConfidence,
        consecutiveDetections: this.consecutiveDetections,
        quality
      });
    }
    
    return {
      isFingerDetected: finalDetection,
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
