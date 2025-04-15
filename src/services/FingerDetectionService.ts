
/**
 * Centralized service for finger detection
 * Consolidates finger detection logic from various parts of the application
 */

class FingerDetectionService {
  private static instance: FingerDetectionService;
  
  // Detection state
  private fingerDetected: boolean = false;
  private detectionConfidence: number = 0;
  private signalQuality: number = 0;
  private lastDetectionTime: number = 0;
  private detectionStartTime: number | null = null;
  private consecutiveDetections: number = 0;
  
  // Constants
  private readonly MIN_QUALITY_FOR_FINGER: number = 40;
  private readonly REQUIRED_CONSECUTIVE_DETECTIONS: number = 3;
  private readonly MIN_AMPLITUDE: number = 0.2;
  private readonly CONFIRMATION_TIME_MS: number = 500;
  
  // Signal tracking
  private recentValues: number[] = [];
  private recentPatterns: number[] = [];
  
  private constructor() {
    console.log("FingerDetectionService initialized");
  }

  public static getInstance(): FingerDetectionService {
    if (!FingerDetectionService.instance) {
      FingerDetectionService.instance = new FingerDetectionService();
    }
    return FingerDetectionService.instance;
  }

  /**
   * Track signal and update finger detection status
   * Only processes real data
   */
  public updateDetection(
    value: number, 
    quality: number, 
    hasRhythmicPattern: boolean = false
  ): void {
    const currentTime = Date.now();
    
    // Update recent values buffer for amplitude calculation
    this.recentValues.push(value);
    if (this.recentValues.length > 20) {
      this.recentValues.shift();
    }
    
    // Calculate signal amplitude (peak-to-peak)
    const amplitude = this.recentValues.length >= 10 
      ? Math.max(...this.recentValues.slice(-10)) - Math.min(...this.recentValues.slice(-10)) 
      : 0;
    
    // Primary finger detection logic based on real signal characteristics
    const hasMinimumAmplitude = amplitude >= this.MIN_AMPLITUDE;
    const hasMinimumQuality = quality >= this.MIN_QUALITY_FOR_FINGER;
    
    const currentlyDetected = hasMinimumAmplitude && 
                             (hasMinimumQuality || hasRhythmicPattern);
    
    // Update consecutive detections counter
    if (currentlyDetected) {
      this.consecutiveDetections++;
      
      // Start timing for confirmation if not already started
      if (!this.detectionStartTime) {
        this.detectionStartTime = currentTime;
      }
      
      // Check if we have enough consecutive detections and time
      const hasEnoughTime = this.detectionStartTime && 
                           (currentTime - this.detectionStartTime) >= this.CONFIRMATION_TIME_MS;
      
      if (this.consecutiveDetections >= this.REQUIRED_CONSECUTIVE_DETECTIONS && hasEnoughTime) {
        // Finger is now confirmed
        if (!this.fingerDetected) {
          console.log("FingerDetectionService: Finger detected", {
            amplitude,
            quality,
            consecutiveDetections: this.consecutiveDetections,
            detectionTime: new Date(currentTime).toISOString()
          });
        }
        
        this.fingerDetected = true;
        this.detectionConfidence = Math.min(1.0, (this.consecutiveDetections / (this.REQUIRED_CONSECUTIVE_DETECTIONS * 2)) + 0.5);
      }
    } else {
      // Reset counters if the signal doesn't meet criteria
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 2);
      
      if (this.consecutiveDetections <= 0) {
        this.detectionStartTime = null;
        
        if (this.fingerDetected) {
          console.log("FingerDetectionService: Finger detection lost", {
            amplitude,
            quality,
            time: new Date(currentTime).toISOString()
          });
          
          this.fingerDetected = false;
          this.detectionConfidence = 0;
        }
      }
    }
    
    // Update detection time and quality metrics
    this.lastDetectionTime = currentTime;
    this.signalQuality = quality;
  }

  /**
   * Check if finger is currently detected
   */
  public isFingerDetected(): boolean {
    return this.fingerDetected;
  }

  /**
   * Get current detection confidence (0-1)
   */
  public getDetectionConfidence(): number {
    return this.detectionConfidence;
  }

  /**
   * Get current signal quality
   */
  public getSignalQuality(): number {
    return this.signalQuality;
  }

  /**
   * Reset all detection state
   */
  public reset(): void {
    this.fingerDetected = false;
    this.detectionConfidence = 0;
    this.signalQuality = 0;
    this.lastDetectionTime = 0;
    this.detectionStartTime = null;
    this.consecutiveDetections = 0;
    this.recentValues = [];
    this.recentPatterns = [];
    
    console.log("FingerDetectionService: Reset complete");
  }
}

// Create and export singleton instance
const instance = FingerDetectionService.getInstance();
export default instance;
