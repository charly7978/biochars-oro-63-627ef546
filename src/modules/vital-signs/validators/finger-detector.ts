
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { VitalSignsConfig } from '../../../core/config/VitalSignsConfig';
import { checkSignalQuality, calculateSignalQuality } from '../../heart-beat/signal-quality';

// State machine for finger detection
type FingerState = 'NO_FINGER' | 'POSSIBLE_FINGER' | 'FINGER_DETECTED' | 'STABLE_SIGNAL';

/**
 * Unified finger detector that integrates all finger detection approaches
 * No simulation or reference values are used
 */
export class FingerDetector {
  // Configuration from central config
  private readonly PERFUSION_INDEX_THRESHOLD = VitalSignsConfig.fingerDetection.PERFUSION_INDEX_THRESHOLD;
  private readonly PEAK_THRESHOLD = VitalSignsConfig.fingerDetection.PEAK_THRESHOLD;
  private readonly LOW_SIGNAL_THRESHOLD = VitalSignsConfig.fingerDetection.LOW_SIGNAL_THRESHOLD;
  private readonly MAX_WEAK_SIGNALS = VitalSignsConfig.fingerDetection.MAX_WEAK_SIGNALS;
  private readonly HISTORY_SIZE = VitalSignsConfig.fingerDetection.HISTORY_SIZE;
  private readonly STABILITY_THRESHOLD = VitalSignsConfig.fingerDetection.STABILITY_THRESHOLD;
  private readonly MIN_PHYSIOLOGICAL_SIGNALS = VitalSignsConfig.fingerDetection.MIN_PHYSIOLOGICAL_SIGNALS;
  
  // State tracking
  private weakSignalsCount: number = 0;
  private signalHistory: number[] = [];
  private signalQualityHistory: number[] = [];
  private lastDetectionTime: number = 0;
  private currentState: FingerState = 'NO_FINGER';
  private stateConfidence: number = 0;
  private validPhysiologicalSignalsCount: number = 0;
  
  // Frame rate tracking
  private lastFrameTime: number = 0;
  private frameRateHistory: number[] = [];
  
  /**
   * Update finger detection state with new signal value
   * @param ppgValue Current PPG signal value
   * @returns Boolean indicating whether a finger is detected
   */
  public updateDetection(ppgValue: number): boolean {
    // Update frame rate tracking
    const now = Date.now();
    if (this.lastFrameTime > 0) {
      const frameDelta = now - this.lastFrameTime;
      this.frameRateHistory.push(frameDelta);
      if (this.frameRateHistory.length > 10) {
        this.frameRateHistory.shift();
      }
    }
    this.lastFrameTime = now;
    
    // Update signal history
    this.updateSignalHistory(ppgValue);
    
    // Check signal quality
    const { isWeakSignal, updatedWeakSignalsCount } = checkSignalQuality(
      ppgValue,
      this.weakSignalsCount,
      {
        lowSignalThreshold: this.LOW_SIGNAL_THRESHOLD,
        maxWeakSignalCount: this.MAX_WEAK_SIGNALS
      }
    );
    
    this.weakSignalsCount = updatedWeakSignalsCount;
    
    // Check signal stability and physiological patterns
    const isStable = this.checkSignalStability();
    const signalQuality = this.signalHistory.length >= 10 ? 
      calculateSignalQuality(this.signalHistory.slice(-10)) : 0;
    
    // Update signal quality history
    this.signalQualityHistory.push(signalQuality);
    if (this.signalQualityHistory.length > 5) {
      this.signalQualityHistory.shift();
    }
    
    // Calculate average quality
    const avgQuality = this.signalQualityHistory.reduce((a, b) => a + b, 0) / 
                     Math.max(1, this.signalQualityHistory.length);
    
    // Update finger state machine
    this.updateStateMachine(ppgValue, isWeakSignal, isStable, avgQuality);
    
    // Return true if finger is detected in appropriate states
    return this.currentState === 'FINGER_DETECTED' || this.currentState === 'STABLE_SIGNAL';
  }
  
  /**
   * Update the finger detection state machine
   */
  private updateStateMachine(
    ppgValue: number, 
    isWeakSignal: boolean, 
    isStable: boolean,
    signalQuality: number
  ): void {
    const now = Date.now();
    
    // Update physiological validation counter
    if (!isWeakSignal && isStable && signalQuality > 0.5 && Math.abs(ppgValue) > 0) {
      this.validPhysiologicalSignalsCount = Math.min(
        this.MIN_PHYSIOLOGICAL_SIGNALS + 10, 
        this.validPhysiologicalSignalsCount + 1
      );
    } else {
      this.validPhysiologicalSignalsCount = Math.max(0, this.validPhysiologicalSignalsCount - 0.5);
    }
    
    // State machine transitions
    switch (this.currentState) {
      case 'NO_FINGER':
        if (!isWeakSignal && signalQuality > 0.4) {
          this.currentState = 'POSSIBLE_FINGER';
          this.stateConfidence = 0.3;
        }
        break;
        
      case 'POSSIBLE_FINGER':
        if (isWeakSignal || signalQuality < 0.3) {
          this.currentState = 'NO_FINGER';
          this.stateConfidence = 0;
        } else if (this.validPhysiologicalSignalsCount > this.MIN_PHYSIOLOGICAL_SIGNALS / 2) {
          this.currentState = 'FINGER_DETECTED';
          this.stateConfidence = 0.7;
          this.lastDetectionTime = now;
        }
        break;
        
      case 'FINGER_DETECTED':
        if (isWeakSignal && this.validPhysiologicalSignalsCount < this.MIN_PHYSIOLOGICAL_SIGNALS / 4) {
          this.currentState = 'NO_FINGER';
          this.stateConfidence = 0;
        } else if (isStable && signalQuality > 0.7 && 
                   this.validPhysiologicalSignalsCount >= this.MIN_PHYSIOLOGICAL_SIGNALS) {
          this.currentState = 'STABLE_SIGNAL';
          this.stateConfidence = 0.9;
        }
        break;
        
      case 'STABLE_SIGNAL':
        if (isWeakSignal && this.validPhysiologicalSignalsCount < this.MIN_PHYSIOLOGICAL_SIGNALS / 2) {
          this.currentState = 'POSSIBLE_FINGER';
          this.stateConfidence = 0.4;
        } else if (signalQuality < 0.5) {
          this.currentState = 'FINGER_DETECTED';
          this.stateConfidence = 0.6;
        }
        break;
    }
  }
  
  /**
   * Update signal history for stability analysis
   */
  private updateSignalHistory(ppgValue: number): void {
    this.signalHistory.push(ppgValue);
    if (this.signalHistory.length > this.HISTORY_SIZE) {
      this.signalHistory.shift();
    }
  }
  
  /**
   * Check signal stability to prevent false positives
   */
  private checkSignalStability(): boolean {
    if (this.signalHistory.length < this.HISTORY_SIZE / 2) {
      return false;
    }
    
    // Calculate signal variation
    const values = this.signalHistory.slice(-10);
    
    // Check if we have a reasonable min/max range
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    if (range < 0.10) { // Minimum physiological range
      return false;
    }
    
    // Calculate variance normalized by the mean
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    
    // Skip very low signals
    if (mean < 0.05) {
      return false;
    }
    
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const normalizedVariance = variance / (mean * mean);
    
    // Check if normalized variance is within physiological range
    return normalizedVariance > 0.05 && normalizedVariance < this.STABILITY_THRESHOLD;
  }
  
  /**
   * Get the current detection state
   */
  public getState(): {
    state: FingerState;
    confidence: number;
    signalQuality: number;
  } {
    const avgQuality = this.signalQualityHistory.length > 0 ?
      this.signalQualityHistory.reduce((a, b) => a + b, 0) / this.signalQualityHistory.length : 0;
    
    return {
      state: this.currentState,
      confidence: this.stateConfidence,
      signalQuality: avgQuality
    };
  }
  
  /**
   * Reset the detector
   */
  public reset(): void {
    this.weakSignalsCount = 0;
    this.signalHistory = [];
    this.signalQualityHistory = [];
    this.lastDetectionTime = 0;
    this.currentState = 'NO_FINGER';
    this.stateConfidence = 0;
    this.validPhysiologicalSignalsCount = 0;
    this.frameRateHistory = [];
    this.lastFrameTime = 0;
  }
}
