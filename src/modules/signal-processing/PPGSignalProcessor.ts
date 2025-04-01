
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * PPG Signal Processor - Core component for signal processing
 */

import { SignalProcessor, ProcessedPPGSignal, SignalProcessingOptions } from './types';
import { detectFinger } from './utils/finger-detection';

/**
 * Default processing options
 */
const DEFAULT_OPTIONS: SignalProcessingOptions = {
  amplificationFactor: 2.0,
  filterStrength: 0.5,
  qualityThreshold: 0.3,
  fingerDetectionSensitivity: 0.5,
  useAdaptiveControl: true,
  qualityEnhancedByPrediction: false,
  predictionHorizon: 3,
  adaptationRate: 0.1
};

/**
 * PPG Signal Processor class
 * Processes raw PPG signals to extract filtered, normalized, and quality information
 */
export class PPGSignalProcessor implements SignalProcessor<ProcessedPPGSignal> {
  private options: SignalProcessingOptions;
  private buffer: number[] = [];
  private readonly BUFFER_SIZE = 100;
  private baseline: number = 0;
  private signalQuality: number = 0;
  private noiseLevel: number = 0;
  private lastTimestamp: number = 0;
  
  /**
   * Constructor
   */
  constructor(options: Partial<SignalProcessingOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    console.log("PPGSignalProcessor: Instancia creada");
  }
  
  /**
   * Configure the processor
   */
  public configure(options: Partial<SignalProcessingOptions>): void {
    this.options = { ...this.options, ...options };
  }
  
  /**
   * Process a raw PPG signal value
   */
  public processSignal(value: number): ProcessedPPGSignal {
    // Update buffer
    this.buffer.push(value);
    if (this.buffer.length > this.BUFFER_SIZE) {
      this.buffer.shift();
    }
    
    // Basic signal processing
    // This is a simplified implementation - a real processor would have more sophisticated algorithms
    const filteredValue = this.applyFilter(value);
    const normalizedValue = this.normalizeValue(filteredValue);
    const amplifiedValue = normalizedValue * this.options.amplificationFactor!;
    
    // Update quality metrics
    this.updateQualityMetrics(value, filteredValue);
    
    // Detect finger presence
    const signalStrength = this.calculateSignalStrength();
    const fingerDetected = detectFinger(signalStrength, this.signalQuality);
    
    return {
      timestamp: Date.now(),
      rawValue: value,
      filteredValue,
      normalizedValue,
      amplifiedValue,
      quality: this.signalQuality * 100, // Convert to 0-100 scale
      fingerDetected,
      signalStrength
    };
  }
  
  /**
   * Apply filtering to raw signal
   */
  private applyFilter(value: number): number {
    if (this.buffer.length <= 1) {
      return value;
    }
    
    // Simple moving average filter
    const windowSize = Math.min(5, this.buffer.length);
    const window = [...this.buffer.slice(-windowSize + 1), value];
    const sum = window.reduce((sum, val) => sum + val, 0);
    return sum / window.length;
  }
  
  /**
   * Normalize value relative to baseline
   */
  private normalizeValue(value: number): number {
    // Update baseline using exponential moving average
    if (this.baseline === 0) {
      this.baseline = value;
    } else {
      this.baseline = this.baseline * 0.95 + value * 0.05;
    }
    
    // Normalize relative to baseline
    return (value - this.baseline) / Math.max(0.1, Math.abs(this.baseline));
  }
  
  /**
   * Update signal quality metrics
   */
  private updateQualityMetrics(rawValue: number, filteredValue: number): void {
    // Calculate noise as difference between raw and filtered
    const instantNoise = Math.abs(rawValue - filteredValue);
    this.noiseLevel = this.noiseLevel * 0.9 + instantNoise * 0.1;
    
    // Calculate signal variance (simplified)
    let variance = 0;
    if (this.buffer.length >= 10) {
      const recentValues = this.buffer.slice(-10);
      const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    }
    
    // Signal quality is inversely related to noise and positively related to variance
    // Normalize to 0-1 range
    const signalToNoise = variance / Math.max(0.0001, this.noiseLevel);
    this.signalQuality = Math.min(1, Math.max(0, signalToNoise / 10));
    
    // Apply additional factors from options
    if (this.options.qualityThreshold) {
      this.signalQuality *= Math.min(1, this.signalQuality / this.options.qualityThreshold);
    }
  }
  
  /**
   * Calculate signal strength metric
   */
  private calculateSignalStrength(): number {
    if (this.buffer.length < 10) {
      return 0;
    }
    
    // Calculate peak-to-peak amplitude in recent values
    const recentValues = this.buffer.slice(-10);
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const peakToPeak = max - min;
    
    // Normalize to 0-1 range (assuming typical PPG amplitude range)
    return Math.min(1, Math.max(0, peakToPeak / 0.2));
  }
  
  /**
   * Reset the processor
   */
  public reset(): void {
    this.buffer = [];
    this.baseline = 0;
    this.signalQuality = 0;
    this.noiseLevel = 0;
    this.lastTimestamp = 0;
  }
}
