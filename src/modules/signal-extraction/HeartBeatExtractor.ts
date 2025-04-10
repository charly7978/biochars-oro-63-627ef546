/**
 * Heart Beat Extractor
 * Analyzes PPG signals to detect heart beats and calculate heart rate
 */

import { EventType, eventBus } from '../events/EventBus';
import { 
  HeartBeatResult, 
  PPGSignal, 
  ProcessingError, 
  HeartBeatData 
} from '../types/signal';
import { CircularBuffer } from '../../utils/CircularBuffer';

export class HeartBeatExtractor {
  // Buffers and state
  private signalBuffer = new CircularBuffer<number>(60);
  private bpmHistory = new CircularBuffer<number>(12);
  private peakBuffer = new CircularBuffer<boolean>(5);
  private rrIntervals: number[] = [];
  
  // Detection state
  private lastPeakTime: number | null = null;
  private previousPeakTime: number | null = null;
  private lastValue: number = 0;
  private baseline: number = 0;
  private smoothBPM: number = 0;
  private lastConfirmedPeak: boolean = false;
  
  // Constants
  private readonly SAMPLE_RATE = 30;
  private readonly MIN_BPM = 40;
  private readonly MAX_BPM = 200;
  private readonly SIGNAL_THRESHOLD = 0.60;
  private readonly MIN_CONFIDENCE = 0.50;
  private readonly DERIVATIVE_THRESHOLD = -0.03;
  private readonly MIN_PEAK_TIME_MS = 400;
  private readonly BPM_SMOOTHING_FACTOR = 0.2;
  private readonly BASELINE_ADAPTATION_RATE = 0.005;
  
  constructor() {
    // Subscribe to PPG signal events
    eventBus.subscribe(EventType.SIGNAL_EXTRACTED, this.processPPGSignal.bind(this));
    
    // Subscribe to monitoring state events
    eventBus.subscribe(EventType.MONITORING_RESET, this.reset.bind(this));
    
    console.log('Heart Beat Extractor initialized');
  }
  
  /**
   * Process a PPG signal to detect heart beats
   */
  private processPPGSignal(ppgSignal: PPGSignal): void {
    try {
      // Skip processing if finger is not detected
      if (!ppgSignal.fingerDetected) return;
      
      // Get filtered value from PPG signal
      const value = ppgSignal.filteredValue;
      
      // Add to signal buffer
      this.signalBuffer.push(value);
      
      // Update baseline
      this.updateBaseline(value);
      
      // Normalize signal
      const normalizedValue = value - this.baseline;
      
      // Calculate derivative for peak detection
      const derivative = value - this.lastValue;
      this.lastValue = value;
      
      // Detect peaks in the signal
      const { isPeak, confidence } = this.detectPeak(normalizedValue, derivative);
      const isConfirmedPeak = this.confirmPeak(isPeak, confidence);
      
      // Process peak if detected
      if (isConfirmedPeak) {
        const now = ppgSignal.timestamp;
        const timeSinceLastPeak = this.lastPeakTime
          ? now - this.lastPeakTime
          : Number.MAX_VALUE;
        
        // Ensure minimum time between peaks
        if (timeSinceLastPeak >= this.MIN_PEAK_TIME_MS) {
          this.previousPeakTime = this.lastPeakTime;
          this.lastPeakTime = now;
          
          // Update BPM calculation
          this.updateBPM();
          
          // Update RR intervals for HRV analysis
          if (this.previousPeakTime && this.lastPeakTime) {
            const rrInterval = this.lastPeakTime - this.previousPeakTime;
            this.rrIntervals.push(rrInterval);
            
            // Keep RR intervals history to a reasonable size
            if (this.rrIntervals.length > 20) {
              this.rrIntervals.shift();
            }
          }
          
          // Create heart beat result
          const heartBeatResult: HeartBeatResult = {
            timestamp: now,
            bpm: Math.round(this.getSmoothBPM()),
            confidence: confidence,
            isPeak: true,
            filteredValue: value,
            peaks: [],
            quality: Math.round(confidence * 100),
            intervals: [...this.rrIntervals],
            lastPeakTime: this.lastPeakTime
          };
          
          // Publish heart beat detected event
          eventBus.publish(EventType.HEARTBEAT_PEAK_DETECTED, heartBeatResult);
          
          // Publish heart rate change event if BPM is valid
          if (heartBeatResult.bpm > 0) {
            eventBus.publish(EventType.HEARTBEAT_RATE_CHANGED, {
              heartRate: heartBeatResult.bpm,
              confidence
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing heart beat:', error);
      const processingError: ProcessingError = {
        code: 'HEARTBEAT_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Error processing heart beat',
        timestamp: Date.now()
      };
      eventBus.publish(EventType.ERROR_OCCURRED, processingError);
    }
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
   * Detect peaks in the heart beat signal
   */
  private detectPeak(normalizedValue: number, derivative: number): { 
    isPeak: boolean; 
    confidence: number 
  } {
    // Check if enough time has passed since last peak
    const now = Date.now();
    const timeSinceLastPeak = this.lastPeakTime
      ? now - this.lastPeakTime
      : Number.MAX_VALUE;
    
    if (timeSinceLastPeak < this.MIN_PEAK_TIME_MS) {
      return { isPeak: false, confidence: 0 };
    }
    
    // Detect peak based on signal characteristics
    const isPeak =
      derivative < this.DERIVATIVE_THRESHOLD &&
      normalizedValue > this.SIGNAL_THRESHOLD &&
      this.lastValue > this.baseline * 0.98;
    
    // Calculate confidence based on signal characteristics
    const amplitudeConfidence = Math.min(
      Math.max(Math.abs(normalizedValue) / (this.SIGNAL_THRESHOLD * 1.8), 0),
      1
    );
    const derivativeConfidence = Math.min(
      Math.max(Math.abs(derivative) / Math.abs(this.DERIVATIVE_THRESHOLD * 0.8), 0),
      1
    );
    
    const confidence = (amplitudeConfidence + derivativeConfidence) / 2;
    
    return { isPeak, confidence };
  }
  
  /**
   * Confirm peaks with additional validation
   */
  private confirmPeak(isPeak: boolean, confidence: number): boolean {
    // Add to peak buffer for consensus detection
    this.peakBuffer.push(isPeak && confidence >= this.MIN_CONFIDENCE);
    
    // Reset peak confirmation if not a peak
    if (!isPeak) {
      this.lastConfirmedPeak = false;
      return false;
    }
    
    // Skip if already confirmed
    if (this.lastConfirmedPeak) {
      return false;
    }
    
    // Check if confidence threshold is met
    if (confidence < this.MIN_CONFIDENCE) {
      return false;
    }
    
    // Get consensus from peak buffer
    const peakVotes = this.peakBuffer.getValues().filter(p => p).length;
    const isPeakConsensus = peakVotes >= 2;
    
    if (isPeakConsensus) {
      this.lastConfirmedPeak = true;
      return true;
    }
    
    return false;
  }
  
  /**
   * Update BPM calculation when a new peak is detected
   */
  private updateBPM(): void {
    if (!this.lastPeakTime || !this.previousPeakTime) return;
    
    const interval = this.lastPeakTime - this.previousPeakTime;
    if (interval <= 0) return;
    
    const instantBPM = 60000 / interval;
    
    // Validate BPM is in reasonable range
    if (instantBPM >= this.MIN_BPM && instantBPM <= this.MAX_BPM) {
      this.bpmHistory.push(instantBPM);
    }
  }
  
  /**
   * Get smoothed BPM value
   */
  private getSmoothBPM(): number {
    const rawBPM = this.calculateCurrentBPM();
    
    if (this.smoothBPM === 0 && rawBPM > 0) {
      this.smoothBPM = rawBPM;
      return rawBPM;
    }
    
    if (rawBPM > 0) {
      this.smoothBPM = (this.BPM_SMOOTHING_FACTOR * rawBPM) + 
                       ((1 - this.BPM_SMOOTHING_FACTOR) * this.smoothBPM);
    }
    
    return this.smoothBPM;
  }
  
  /**
   * Calculate current BPM from recent history
   */
  private calculateCurrentBPM(): number {
    const bpmValues = this.bpmHistory.getValues();
    if (bpmValues.length < 2) {
      return 0;
    }
    
    // Sort and trim outliers
    const sorted = [...bpmValues].sort((a, b) => a - b);
    const trimmed = sorted.length > 4 
      ? sorted.slice(1, -1)  // Remove potential outliers if we have enough data
      : sorted;
    
    if (trimmed.length === 0) return 0;
    
    // Calculate average
    const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
    return avg;
  }
  
  /**
   * Get final BPM calculation with higher confidence
   */
  getFinalBPM(): number {
    const bpmValues = this.bpmHistory.getValues();
    if (bpmValues.length < 5) {
      return 0;
    }
    
    // Remove outliers more aggressively for final result
    const sorted = [...bpmValues].sort((a, b) => a - b);
    const cut = Math.round(sorted.length * 0.2);
    const finalSet = sorted.slice(cut, sorted.length - cut);
    
    if (finalSet.length === 0) return 0;
    
    const sum = finalSet.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / finalSet.length);
  }
  
  /**
   * Get current heart rate and detection data
   */
  getCurrentHeartRate(): {
    bpm: number;
    confidence: number;
    rrIntervals: number[];
  } {
    return {
      bpm: Math.round(this.getSmoothBPM()),
      confidence: this.bpmHistory.getValues().length > 5 ? 0.9 : 0.5,
      rrIntervals: [...this.rrIntervals]
    };
  }
  
  /**
   * Reset all internal state
   */
  reset(): void {
    this.signalBuffer.clear();
    this.bpmHistory.clear();
    this.peakBuffer.clear();
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.previousPeakTime = null;
    this.lastValue = 0;
    this.baseline = 0;
    this.smoothBPM = 0;
    this.lastConfirmedPeak = false;
    
    console.log('Heart Beat Extractor reset');
  }
}

// Export singleton instance
export const heartBeatExtractor = new HeartBeatExtractor();
