
/**
 * Centralized service for finger detection
 * Provides a unified approach to detect finger presence across the application
 */

import { toast } from "@/hooks/use-toast";
import { SignalQualityOptions } from '@/modules/heart-beat/signal-quality';

export interface FingerDetectionOptions extends SignalQualityOptions {
  requireConsistentDetection?: boolean;
  detectionThreshold?: number;
  minQualityRequired?: number;
  patternBasedDetection?: boolean;
}

export interface FingerDetectionResult {
  isFingerDetected: boolean;
  quality: number;
  detectionMethod: 'pattern' | 'amplitude' | 'combined' | 'none';
  confidence: number;
}

export interface FingerEventHandler {
  (result: FingerDetectionResult): void;
}

class FingerDetectionServiceClass {
  private static instance: FingerDetectionServiceClass;
  
  // Detection state
  private fingerDetected: boolean = false;
  private consecutiveDetections: number = 0;
  private consecutiveRejections: number = 0;
  private lastQualityValues: number[] = [];
  private detectionStartTime: number | null = null;
  private detectionConfirmed: boolean = false;
  private lastSignalAmplitude: number = 0;
  private lastDetectionTime: number = 0;
  
  // Finger detection constants
  private readonly DEFAULT_DETECTION_THRESHOLD: number = 3;
  private readonly DEFAULT_MIN_QUALITY: number = 40;
  private readonly MAX_QUALITY_HISTORY: number = 10;
  private readonly MIN_AMPLITUDE: number = 0.18;
  private readonly MIN_CONFIRMATION_TIME: number = 700;
  
  // Event listeners
  private eventListeners: FingerEventHandler[] = [];
  
  private constructor() {
    console.log("FingerDetectionService: Centralized service initialized");
  }

  public static getInstance(): FingerDetectionServiceClass {
    if (!FingerDetectionServiceClass.instance) {
      FingerDetectionServiceClass.instance = new FingerDetectionServiceClass();
    }
    return FingerDetectionServiceClass.instance;
  }

  /**
   * Register for finger detection events
   */
  public addEventListener(listener: FingerEventHandler): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(listener: FingerEventHandler): void {
    this.eventListeners = this.eventListeners.filter(l => l !== listener);
  }

  /**
   * Notify all listeners about finger detection changes
   */
  private notifyListeners(result: FingerDetectionResult): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error("Error in finger detection listener:", error);
      }
    });
  }

  /**
   * Process finger detection based on signal quality and amplitude
   */
  public detectFinger(
    signalValue: number,
    quality: number,
    recentValues: number[],
    options: FingerDetectionOptions = {}
  ): FingerDetectionResult {
    const currentTime = Date.now();
    
    // Store quality history
    this.lastQualityValues.push(quality);
    if (this.lastQualityValues.length > this.MAX_QUALITY_HISTORY) {
      this.lastQualityValues.shift();
    }
    
    // Calculate average quality
    const avgQuality = this.calculateAverageQuality();
    
    // Calculate amplitude from recent values
    let amplitude = 0;
    if (recentValues && recentValues.length > 5) {
      const recentSample = recentValues.slice(-10);
      amplitude = Math.max(...recentSample) - Math.min(...recentSample);
    }
    this.lastSignalAmplitude = amplitude;
    
    // Get detection thresholds from options or defaults
    const detectionThreshold = options.detectionThreshold || this.DEFAULT_DETECTION_THRESHOLD;
    const minQualityRequired = options.minQualityRequired || this.DEFAULT_MIN_QUALITY;
    
    // Determine if finger is detected based on quality and amplitude
    const hasMinQuality = avgQuality >= minQualityRequired;
    const hasValidAmplitude = amplitude >= this.MIN_AMPLITUDE;
    
    // Potential detection based on both quality and amplitude
    const potentialDetection = hasMinQuality && hasValidAmplitude;
    
    // Update detection counters
    if (potentialDetection) {
      this.consecutiveDetections = Math.min(10, this.consecutiveDetections + 1);
      this.consecutiveRejections = 0;
    } else {
      this.consecutiveRejections = Math.min(10, this.consecutiveRejections + 1);
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
    }
    
    // Require consistent detection for confirmation
    const consistentDetection = this.consecutiveDetections >= detectionThreshold;
    
    // Handle initial detection
    if (consistentDetection && !this.detectionConfirmed) {
      if (!this.detectionStartTime) {
        this.detectionStartTime = currentTime;
        console.log("FingerDetectionService: Potential finger detection started", {
          time: new Date(currentTime).toISOString(),
          quality: avgQuality,
          amplitude
        });
      }
      
      // Confirm detection after sufficient time with consistent readings
      if (currentTime - (this.detectionStartTime || 0) >= this.MIN_CONFIRMATION_TIME) {
        this.detectionConfirmed = true;
        this.fingerDetected = true;
        
        console.log("FingerDetectionService: Finger detection CONFIRMED", {
          time: new Date(currentTime).toISOString(),
          quality: avgQuality,
          amplitude,
          method: 'combined'
        });
      }
    } else if (!consistentDetection && this.consecutiveRejections >= detectionThreshold) {
      // Reset detection if lost
      if (this.fingerDetected) {
        console.log("FingerDetectionService: Finger detection lost", {
          consecutiveRejections: this.consecutiveRejections,
          quality: avgQuality,
          amplitude
        });
      }
      
      this.fingerDetected = false;
      this.detectionConfirmed = false;
      this.detectionStartTime = null;
    }
    
    // Build result
    const result: FingerDetectionResult = {
      isFingerDetected: this.fingerDetected,
      quality: avgQuality,
      detectionMethod: this.getDetectionMethod(hasMinQuality, hasValidAmplitude),
      confidence: this.calculateConfidence(avgQuality, amplitude)
    };
    
    // Notify listeners if state changed
    if (currentTime - this.lastDetectionTime > 300) {
      this.notifyListeners(result);
      this.lastDetectionTime = currentTime;
    }
    
    return result;
  }
  
  /**
   * Determine detection method based on criteria met
   */
  private getDetectionMethod(hasQuality: boolean, hasAmplitude: boolean): FingerDetectionResult['detectionMethod'] {
    if (hasQuality && hasAmplitude) return 'combined';
    if (hasQuality) return 'pattern';
    if (hasAmplitude) return 'amplitude';
    return 'none';
  }
  
  /**
   * Calculate detection confidence based on signal quality and amplitude
   */
  private calculateConfidence(quality: number, amplitude: number): number {
    const qualityFactor = quality / 100;
    const amplitudeFactor = Math.min(1, amplitude / 0.5);
    
    return (qualityFactor * 0.7) + (amplitudeFactor * 0.3);
  }
  
  /**
   * Calculate weighted average quality giving more weight to recent values
   */
  private calculateAverageQuality(): number {
    if (this.lastQualityValues.length === 0) return 0;
    
    let weightedSum = 0;
    let weightSum = 0;
    
    this.lastQualityValues.forEach((q, index) => {
      const weight = index + 1;
      weightedSum += q * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? weightedSum / weightSum : 0;
  }
  
  /**
   * Force finger detection status - useful for testing
   */
  public forceFingerDetection(isDetected: boolean): void {
    this.fingerDetected = isDetected;
    this.detectionConfirmed = isDetected;
    
    const result: FingerDetectionResult = {
      isFingerDetected: isDetected,
      quality: isDetected ? 80 : 0,
      detectionMethod: isDetected ? 'combined' : 'none',
      confidence: isDetected ? 0.9 : 0
    };
    
    this.notifyListeners(result);
    
    console.log(`FingerDetectionService: Detection FORCED to ${isDetected ? 'detected' : 'not detected'}`);
    
    if (isDetected) {
      toast({
        title: 'Dedo detectado',
        description: 'Se ha forzado la detección del dedo',
        variant: 'default',
        duration: 3000
      });
    }
  }
  
  /**
   * Check if finger is currently detected
   */
  public isFingerDetected(): boolean {
    return this.fingerDetected;
  }
  
  /**
   * Get current finger detection quality
   */
  public getQuality(): number {
    return this.calculateAverageQuality();
  }
  
  /**
   * Reset all detection state
   */
  public reset(): void {
    this.fingerDetected = false;
    this.consecutiveDetections = 0;
    this.consecutiveRejections = 0;
    this.lastQualityValues = [];
    this.detectionStartTime = null;
    this.detectionConfirmed = false;
    this.lastSignalAmplitude = 0;
    
    console.log("FingerDetectionService: Detection state reset");
  }
}

const FingerDetectionService = FingerDetectionServiceClass.getInstance();
export default FingerDetectionService;
