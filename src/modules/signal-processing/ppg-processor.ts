
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * PPG signal processor implementation
 */

import { PPGSignalProcessor } from './interfaces';
import { ProcessedPPGSignal, SignalProcessingOptions } from './types';
import { isFingerDetected, resetFingerDetector } from './finger-detector';
import { 
  applyAdaptiveFilter, 
  predictNextValue,
  correctSignalAnomalies
} from './utils/adaptive-predictor';

/**
 * Class for processing PPG signals
 */
export class PPGProcessor implements PPGSignalProcessor {
  private signalBuffer: number[] = [];
  private maxBufferSize: number = 100;
  private quality: number = 0;
  private fingerDetected: boolean = false;
  private lastRawValue: number = 0;
  private lastValue: number = 0;
  private valueHistory: number[] = [];
  private qualityHistory: number[] = [];
  private options: SignalProcessingOptions = {
    filterStrength: 0.3,
    qualityThreshold: 0.4,
    adaptiveFiltering: true,
    fingerDetectionSensitivity: 1.0,
    amplificationFactor: 2.0,
    useAdaptiveControl: true,
    qualityEnhancedByPrediction: true
  };

  constructor() {
    console.log('PPGProcessor: Initialized');
  }

  /**
   * Process a PPG signal sample
   */
  processSignal(signal: number): ProcessedPPGSignal {
    const timestamp = Date.now();
    let rawValue = signal;
    
    // Store raw value
    this.lastRawValue = rawValue;
    
    // Check finger detection
    this.fingerDetected = isFingerDetected(rawValue, this.signalBuffer, this.options.fingerDetectionSensitivity || 1.0);
    
    // Add to buffer
    this.signalBuffer.push(rawValue);
    if (this.signalBuffer.length > this.maxBufferSize) {
      this.signalBuffer.shift();
    }
    
    // Filter signal
    let filteredValue = rawValue;
    if (this.options.adaptiveFiltering && this.signalBuffer.length >= 3) {
      // Apply adaptive filtering
      filteredValue = applyAdaptiveFilter(rawValue, this.signalBuffer, this.options.filterStrength || 0.3);
      
      // Correct anomalies if finger is detected
      if (this.fingerDetected && this.options.useAdaptiveControl) {
        filteredValue = correctSignalAnomalies(filteredValue, this.valueHistory, 2.0);
      }
    }
    
    // Update signal quality
    this.updateSignalQuality(filteredValue);
    
    // Apply amplification if finger detected and option enabled
    const amplifiedValue = this.options.amplificationFactor && this.options.amplificationFactor > 1.0 
      ? filteredValue * this.options.amplificationFactor
      : filteredValue;
    
    // Add to history
    this.valueHistory.push(filteredValue);
    if (this.valueHistory.length > 20) {
      this.valueHistory.shift();
    }
    
    // Store filtered value
    this.lastValue = filteredValue;
    
    // Calculate normalized value (0-1 range based on recent min/max)
    const normalizedValue = this.normalizeValue(filteredValue);
    
    // Calculate signal strength
    const signalStrength = this.fingerDetected ? this.calculateSignalStrength() : 0;
    
    // Update quality metrics if enabled
    if (this.options.qualityEnhancedByPrediction && this.valueHistory.length >= 3) {
      this.updateQualityWithPrediction();
    }
    
    return {
      timestamp,
      rawValue,
      filteredValue,
      normalizedValue,
      quality: this.quality,
      fingerDetected: this.fingerDetected,
      amplifiedValue,
      signalStrength
    };
  }

  /**
   * Reset processor state
   */
  reset(): void {
    this.signalBuffer = [];
    this.quality = 0;
    this.fingerDetected = false;
    this.lastRawValue = 0;
    this.lastValue = 0;
    this.valueHistory = [];
    this.qualityHistory = [];
    resetFingerDetector();
  }

  /**
   * Configure processor options
   */
  configure(options: Partial<SignalProcessingOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Update signal quality based on stability and signal characteristics
   */
  private updateSignalQuality(value: number): void {
    // Calculate basic signal quality
    let newQuality = 0;
    
    if (this.valueHistory.length >= 10 && this.fingerDetected) {
      // Calculate signal stability
      const recent = this.valueHistory.slice(-10);
      const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
      const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
      const varianceNormalized = Math.min(variance / Math.pow(mean, 2), 1);
      
      // Higher quality for more stable signal, but not too stable
      const stabilityFactor = Math.min(1 - varianceNormalized, 0.9); 
      
      // Signal range factor - higher quality for appropriate dynamic range
      const range = Math.max(...recent) - Math.min(...recent);
      const rangeFactor = range > 0.05 ? Math.min(range * 10, 1) : 0.1;
      
      // Combine factors
      newQuality = stabilityFactor * 0.7 + rangeFactor * 0.3;
    } else if (this.fingerDetected) {
      // Limited history but finger detected
      newQuality = 0.3;
    } else {
      // No finger detected
      newQuality = 0;
    }
    
    // Smooth quality value with history
    this.quality = this.quality * 0.7 + newQuality * 0.3;
    
    // Add to quality history
    this.qualityHistory.push(this.quality);
    if (this.qualityHistory.length > 10) {
      this.qualityHistory.shift();
    }
  }

  /**
   * Normalize value to 0-1 range based on recent min/max
   */
  private normalizeValue(value: number): number {
    if (this.valueHistory.length < 5) return 0.5;
    
    const recent = this.valueHistory.slice(-20);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    
    if (max === min) return 0.5;
    
    return (value - min) / (max - min);
  }

  /**
   * Calculate signal strength metric
   */
  private calculateSignalStrength(): number {
    if (this.valueHistory.length < 10) return 0;
    
    const recent = this.valueHistory.slice(-10);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    
    // Signal strength is based on range and average value
    const range = max - min;
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    
    return Math.min(range * mean * 5, 1);
  }

  /**
   * Update quality based on prediction accuracy
   */
  private updateQualityWithPrediction(): void {
    if (this.valueHistory.length < 5) return;
    
    // Get last prediction (we would have predicted this current value)
    const recentHistory = this.valueHistory.slice(-5, -1);
    const predictedValue = predictNextValue(recentHistory);
    const actualValue = this.valueHistory[this.valueHistory.length - 1];
    
    // Calculate prediction error
    const predictionError = Math.abs(predictedValue - actualValue);
    const meanValue = this.valueHistory.slice(-5).reduce((sum, val) => sum + val, 0) / 5;
    const normalizedError = predictionError / (Math.abs(meanValue) + 0.01);
    
    // Higher quality correlates with better prediction accuracy
    if (normalizedError > 0.3) {
      // Decrease quality for poor predictions
      this.quality = Math.max(0, this.quality - normalizedError * 0.2);
    }
  }
}
