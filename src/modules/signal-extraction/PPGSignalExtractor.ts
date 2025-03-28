
/**
 * PPG Signal Extractor
 * Processes raw camera frames to extract PPG signals
 */

import { EventType, eventBus } from '../events/EventBus';
import { PPGSignal, ProcessingError, RawSignalFrame } from '../types/signal';
import { CircularBuffer } from '../../utils/CircularBuffer';

export class PPGSignalExtractor {
  // Signal history and processing buffers
  private signalBuffer = new CircularBuffer<number>(30);
  private valueHistory = new CircularBuffer<number>(20);
  private qualityHistory = new CircularBuffer<number>(10);
  private lastPPGSignal: PPGSignal | null = null;
  
  // Filter buffers
  private medianBuffer: number[] = [];
  private movingAverageBuffer: number[] = [];
  private lastFilteredValue: number = 0;
  private baseline: number = 0;
  
  // Detection state
  private fingerDetected: boolean = false;
  private fingerDetectionBuffer = new CircularBuffer<boolean>(5);
  private stableCount: number = 0;
  
  // Constants
  private readonly MEDIAN_WINDOW_SIZE = 3;
  private readonly MOVING_AVG_WINDOW_SIZE = 5;
  private readonly MIN_RED_THRESHOLD = 75;
  private readonly MAX_RED_THRESHOLD = 245;
  private readonly STABILITY_THRESHOLD = 0.4;
  private readonly MIN_STABLE_COUNT = 3;
  private readonly BASELINE_ADAPTATION_RATE = 0.005;
  
  constructor() {
    // Subscribe to camera frame events
    eventBus.subscribe(EventType.CAMERA_FRAME, this.processRawSignal.bind(this));
    
    // Subscribe to monitoring state events
    eventBus.subscribe(EventType.MONITORING_RESET, this.reset.bind(this));
    
    console.log('PPG Signal Extractor initialized');
  }
  
  /**
   * Process a raw signal frame from the camera
   */
  private processRawSignal(frame: RawSignalFrame): void {
    try {
      // Use red channel for PPG extraction (most sensitive to blood volume changes)
      const rawValue = frame.redChannel;
      
      // Apply median filter to remove spikes
      const medianValue = this.applyMedianFilter(rawValue);
      
      // Apply moving average filter to smooth signal
      const smoothedValue = this.applyMovingAverageFilter(medianValue);
      
      // Track baseline for signal normalization
      this.updateBaseline(smoothedValue);
      
      // Detect finger presence
      const { fingerDetected, quality } = this.detectFingerPresence(rawValue, smoothedValue);
      
      // Create PPG signal object
      const ppgSignal: PPGSignal = {
        timestamp: frame.timestamp,
        rawValue,
        filteredValue: smoothedValue - this.baseline,
        quality,
        fingerDetected,
        amplified: false,
        perfusionIndex: this.calculatePerfusionIndex()
      };
      
      // Store the signal
      this.lastPPGSignal = ppgSignal;
      
      // Add to value history for trend analysis
      this.valueHistory.push(smoothedValue);
      this.qualityHistory.push(quality);
      
      // Publish the PPG signal
      eventBus.publish(EventType.SIGNAL_EXTRACTED, ppgSignal);
      
      // Publish quality change if significant
      const avgQuality = this.calculateAverageQuality();
      if (Math.abs(avgQuality - quality) > 10) {
        eventBus.publish(EventType.SIGNAL_QUALITY_CHANGED, {
          quality: avgQuality,
          trend: avgQuality > quality ? 'improving' : 'degrading'
        });
      }
      
      // Publish finger detection events
      if (fingerDetected && !this.fingerDetected) {
        eventBus.publish(EventType.FINGER_DETECTED, { timestamp: frame.timestamp });
        this.fingerDetected = true;
      } else if (!fingerDetected && this.fingerDetected) {
        eventBus.publish(EventType.FINGER_LOST, { timestamp: frame.timestamp });
        this.fingerDetected = false;
      }
    } catch (error) {
      console.error('Error processing PPG signal:', error);
      const processingError: ProcessingError = {
        code: 'PPG_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Error processing PPG signal',
        timestamp: Date.now(),
        source: 'PPGSignalExtractor'
      };
      eventBus.publish(EventType.ERROR_OCCURRED, processingError);
    }
  }
  
  /**
   * Apply median filter to input signal
   */
  private applyMedianFilter(value: number): number {
    this.medianBuffer.push(value);
    
    if (this.medianBuffer.length > this.MEDIAN_WINDOW_SIZE) {
      this.medianBuffer.shift();
    }
    
    const sorted = [...this.medianBuffer].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
  
  /**
   * Apply moving average filter to input signal
   */
  private applyMovingAverageFilter(value: number): number {
    this.movingAverageBuffer.push(value);
    
    if (this.movingAverageBuffer.length > this.MOVING_AVG_WINDOW_SIZE) {
      this.movingAverageBuffer.shift();
    }
    
    const sum = this.movingAverageBuffer.reduce((acc, val) => acc + val, 0);
    return sum / this.movingAverageBuffer.length;
  }
  
  /**
   * Update signal baseline using adaptive rate
   */
  private updateBaseline(value: number): void {
    if (this.baseline === 0) {
      this.baseline = value;
    } else {
      this.baseline = this.baseline * (1 - this.BASELINE_ADAPTATION_RATE) + 
                      value * this.BASELINE_ADAPTATION_RATE;
    }
  }
  
  /**
   * Detect if a finger is present based on signal characteristics
   */
  private detectFingerPresence(rawValue: number, filteredValue: number): {
    fingerDetected: boolean;
    quality: number;
  } {
    // Check if raw value is in valid range for finger detection
    const isInRange = rawValue >= this.MIN_RED_THRESHOLD && rawValue <= this.MAX_RED_THRESHOLD;
    
    if (!isInRange) {
      this.stableCount = 0;
      this.fingerDetectionBuffer.push(false);
      return { fingerDetected: false, quality: 0 };
    }
    
    // Calculate signal stability
    const recentValues = this.valueHistory.getValues();
    let stability = 100;
    
    if (recentValues.length >= 3) {
      const variations = [];
      for (let i = 1; i < recentValues.length; i++) {
        variations.push(Math.abs(recentValues[i] - recentValues[i-1]));
      }
      
      const avgVariation = variations.reduce((acc, val) => acc + val, 0) / variations.length;
      const normalizedVariation = avgVariation / (this.baseline || 1);
      
      // Lower variation = higher stability
      stability = Math.max(0, 100 - (normalizedVariation * 200));
    }
    
    // Check for signal stability
    const isStable = stability > 50 || normalizedVariation < this.STABILITY_THRESHOLD;
    
    if (isStable) {
      this.stableCount = Math.min(this.stableCount + 1, this.MIN_STABLE_COUNT * 2);
    } else {
      this.stableCount = Math.max(0, this.stableCount - 1);
    }
    
    // Determine if finger is detected based on stability count
    const isFingerDetected = this.stableCount >= this.MIN_STABLE_COUNT;
    this.fingerDetectionBuffer.push(isFingerDetected);
    
    // Calculate detection consensus (majority vote)
    const detections = this.fingerDetectionBuffer.getValues();
    const detectionCount = detections.filter(d => d).length;
    const consensusDetection = detectionCount > detections.length / 2;
    
    // Calculate signal quality
    let quality = 0;
    
    if (consensusDetection) {
      // Rate quality based on multiple factors
      const intensityScore = Math.min(100, Math.max(0, 
        ((rawValue - this.MIN_RED_THRESHOLD) / (this.MAX_RED_THRESHOLD - this.MIN_RED_THRESHOLD)) * 100
      ));
      
      const stabilityScore = Math.min(100, stability);
      
      // Combined quality score
      quality = Math.round((intensityScore * 0.3) + (stabilityScore * 0.7));
    }
    
    return { 
      fingerDetected: consensusDetection,
      quality 
    };
  }
  
  /**
   * Calculate perfusion index (PI) from recent signals
   */
  private calculatePerfusionIndex(): number {
    const values = this.valueHistory.getValues();
    if (values.length < 10) return 0;
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // PI = (AC/DC) * 100
    const ac = max - min;
    const dc = (max + min) / 2;
    
    return dc > 0 ? (ac / dc) : 0;
  }
  
  /**
   * Calculate average quality from recent measurements
   */
  private calculateAverageQuality(): number {
    const qualities = this.qualityHistory.getValues();
    if (qualities.length === 0) return 0;
    
    return Math.round(
      qualities.reduce((acc, val) => acc + val, 0) / qualities.length
    );
  }
  
  /**
   * Get the last processed PPG signal
   */
  getLastSignal(): PPGSignal | null {
    return this.lastPPGSignal;
  }
  
  /**
   * Get current detection status
   */
  getDetectionStatus(): {
    fingerDetected: boolean;
    quality: number;
    stableCount: number;
  } {
    return {
      fingerDetected: this.fingerDetected,
      quality: this.lastPPGSignal?.quality || 0,
      stableCount: this.stableCount
    };
  }
  
  /**
   * Reset all internal state
   */
  reset(): void {
    this.signalBuffer.clear();
    this.valueHistory.clear();
    this.qualityHistory.clear();
    this.medianBuffer = [];
    this.movingAverageBuffer = [];
    this.fingerDetectionBuffer.clear();
    this.lastFilteredValue = 0;
    this.baseline = 0;
    this.stableCount = 0;
    this.fingerDetected = false;
    this.lastPPGSignal = null;
    
    console.log('PPG Signal Extractor reset');
  }
}

// Export singleton instance
export const ppgSignalExtractor = new PPGSignalExtractor();
