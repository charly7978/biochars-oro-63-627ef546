
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Blood pressure optimized signal channel
 */

import { SpecializedChannel } from './SpecializedChannel';
import { VitalSignType } from '../../../types/signal';

/**
 * Signal channel optimized for blood pressure processing
 */
export class BloodPressureChannel extends SpecializedChannel {
  // Filter parameters
  private readonly LP_FILTER_STRENGTH = 0.8;
  private readonly HP_FILTER_STRENGTH = 0.2;
  
  // Baseline tracking
  private baselineValue: number = 0;
  private baselineSet: boolean = false;
  
  // Dynamic range tracking
  private minValue: number = 0;
  private maxValue: number = 1;
  
  /**
   * Constructor
   */
  constructor() {
    super(VitalSignType.BLOOD_PRESSURE);
  }
  
  /**
   * Process a value for blood pressure optimization
   */
  protected processValueImpl(value: number): number {
    // Initialize baseline if not set
    if (!this.baselineSet && this.buffer.length > 5) {
      this.baselineValue = this.buffer.reduce((sum, val) => sum + val, 0) / this.buffer.length;
      this.baselineSet = true;
      this.minValue = this.baselineValue * 0.9;
      this.maxValue = this.baselineValue * 1.1;
    }
    
    // Update baseline with slow tracking
    if (this.baselineSet) {
      this.baselineValue = this.baselineValue * 0.99 + value * 0.01;
    }
    
    // Apply filtering optimized for blood pressure frequency components
    const filtered = this.applyBPFilter(value);
    
    // Update dynamic range
    if (filtered < this.minValue) this.minValue = filtered * 0.99;
    if (filtered > this.maxValue) this.maxValue = filtered * 1.01;
    
    // Normalize to range for consistent scaling
    const range = Math.max(0.001, this.maxValue - this.minValue);
    const normalized = (filtered - this.minValue) / range;
    
    // Calculate confidence based on signal characteristics
    this.updateConfidence();
    
    return normalized;
  }
  
  /**
   * Apply filters optimized for blood pressure signal characteristics
   */
  private applyBPFilter(value: number): number {
    if (this.buffer.length < 3) {
      return value;
    }
    
    // Apply moving average filter
    let filtered = this.applySMAFilter([...this.buffer.slice(-5), value], 3);
    
    return filtered;
  }
  
  /**
   * Apply Simple Moving Average filter
   */
  private applySMAFilter(values: number[], windowSize: number): number {
    if (values.length === 0) return 0;
    
    const length = Math.min(windowSize, values.length);
    const sum = values.slice(-length).reduce((a, b) => a + b, 0);
    return sum / length;
  }
  
  /**
   * Update the confidence level based on signal quality
   */
  private updateConfidence(): void {
    if (this.buffer.length < 10) {
      this.confidence = 0.5; // Default confidence
      return;
    }
    
    // Calculate signal stability
    const recentValues = this.buffer.slice(-10);
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calculate variance
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    
    // Calculate coefficient of variation (normalized variance)
    const cv = Math.sqrt(variance) / Math.max(0.0001, Math.abs(mean));
    
    // Stable signals have lower CV
    const stabilityFactor = Math.max(0, 1 - Math.min(1, cv * 5));
    
    // Check for appropriate signal range
    const recentRange = Math.max(...recentValues) - Math.min(...recentValues);
    const rangeFactor = Math.min(1, recentRange * 10); // Reasonable range for BP
    
    // Combine factors for overall confidence
    this.confidence = (stabilityFactor * 0.7) + (rangeFactor * 0.3);
  }
  
  /**
   * Reset the channel
   */
  public override reset(): void {
    super.reset();
    this.baselineValue = 0;
    this.baselineSet = false;
    this.minValue = 0;
    this.maxValue = 1;
  }
}
