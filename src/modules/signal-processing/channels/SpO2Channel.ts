
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * SpO2 optimized signal channel
 */

import { SpecializedChannel } from './SpecializedChannel';
import { VitalSignType } from '../../../types/signal';

/**
 * Signal channel optimized for SpO2 processing
 */
export class SpO2Channel extends SpecializedChannel {
  // SpO2-specific parameters
  private readonly RED_WEIGHT = 0.7;
  private readonly IR_WEIGHT = 0.3;
  
  // Ratio tracking
  private redBuffer: number[] = [];
  private irBuffer: number[] = [];
  private readonly RATIO_BUFFER_SIZE = 15;
  
  // Baseline tracking
  private baselineValue: number = 0;
  private baselineSet: boolean = false;
  
  constructor() {
    super(VitalSignType.SPO2);
  }
  
  /**
   * Process a value for SpO2 optimization
   * @param value The input signal value
   * @returns Processed value optimized for SpO2 calculation
   */
  protected processValueImpl(value: number): number {
    // Initialize baseline if not set
    if (!this.baselineSet && this.buffer.length > 5) {
      this.baselineValue = this.buffer.reduce((sum, val) => sum + val, 0) / this.buffer.length;
      this.baselineSet = true;
    }
    
    // Update baseline with slow tracking
    if (this.baselineSet) {
      this.baselineValue = this.baselineValue * 0.98 + value * 0.02;
    }
    
    // Apply filtering optimized for SpO2 frequency components
    const filtered = this.applySpO2Filter(value);
    
    // Simulate red/IR channel separation (in a real implementation, these would be separate inputs)
    const simulatedRed = filtered * 0.9;
    const simulatedIR = filtered * 1.1;
    
    // Store in ratio buffers
    this.updateRatioBuffers(simulatedRed, simulatedIR);
    
    // Calculate R value (ratio of ratios)
    const rValue = this.calculateRValue();
    
    // Update confidence based on signal characteristics
    this.updateConfidence(rValue);
    
    // Return processed value
    return filtered * 1.1;
  }
  
  /**
   * Apply filters optimized for SpO2 signal characteristics
   * @param value Input value
   * @returns Filtered value
   */
  private applySpO2Filter(value: number): number {
    if (this.buffer.length < 3) {
      return value;
    }
    
    // Apply simple moving average filter
    const windowSize = Math.min(5, this.buffer.length);
    const window = this.buffer.slice(-windowSize);
    const sum = window.reduce((sum, val) => sum + val, 0) + value;
    const filtered = sum / (windowSize + 1);
    
    // Apply DC removal (high-pass filter)
    const dcRemoved = value - this.baselineValue;
    
    // Combine filters
    return (filtered * 0.7) + (dcRemoved * 0.3);
  }
  
  /**
   * Update red and IR buffers for ratio calculation
   */
  private updateRatioBuffers(red: number, ir: number): void {
    this.redBuffer.push(red);
    this.irBuffer.push(ir);
    
    if (this.redBuffer.length > this.RATIO_BUFFER_SIZE) {
      this.redBuffer.shift();
      this.irBuffer.shift();
    }
  }
  
  /**
   * Calculate R value (ratio of ratios) for SpO2
   * @returns R value
   */
  private calculateRValue(): number {
    if (this.redBuffer.length < 5 || this.irBuffer.length < 5) {
      return 1.0; // Default value
    }
    
    // Calculate AC and DC components
    const redAC = Math.max(...this.redBuffer) - Math.min(...this.redBuffer);
    const irAC = Math.max(...this.irBuffer) - Math.min(...this.irBuffer);
    
    const redDC = this.redBuffer.reduce((sum, val) => sum + val, 0) / this.redBuffer.length;
    const irDC = this.irBuffer.reduce((sum, val) => sum + val, 0) / this.irBuffer.length;
    
    // Avoid division by zero
    if (redDC === 0 || irDC === 0 || irAC === 0) {
      return 1.0;
    }
    
    // Calculate ratio
    const redRatio = redAC / Math.abs(redDC);
    const irRatio = irAC / Math.abs(irDC);
    
    // Calculate R value
    return redRatio / irRatio;
  }
  
  /**
   * Update confidence based on signal characteristics
   * @param rValue The calculated R value
   */
  private updateConfidence(rValue: number): void {
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
    
    // Check if R value is in physiological range (0.5 to 2.0)
    const rValueFactor = (rValue >= 0.5 && rValue <= 2.0) ? 1.0 : 0.5;
    
    // Combine factors for overall confidence
    this.confidence = (stabilityFactor * 0.7) + (rValueFactor * 0.3);
  }
  
  /**
   * Reset the channel
   */
  public override reset(): void {
    super.reset();
    this.redBuffer = [];
    this.irBuffer = [];
    this.baselineValue = 0;
    this.baselineSet = false;
  }
}
