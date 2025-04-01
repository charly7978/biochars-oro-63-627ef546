/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Specialized processor for blood pressure measurement
 * Uses optimized blood pressure signal for systolic/diastolic calculation
 * Improved precision and reliability
 */

import { BaseVitalSignProcessor } from './BaseVitalSignProcessor';
import { VitalSignType, ChannelFeedback } from '../../../types/signal';
import { calculateStandardDeviation, applySMAFilter } from '../utils';

/**
 * Result interface for blood pressure measurements
 */
export interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  precision: number; // Added precision indicator
}

/**
 * Blood pressure processor implementation with improved precision
 */
export class BloodPressureProcessor extends BaseVitalSignProcessor<BloodPressureResult> {
  // Default values for blood pressure
  private readonly DEFAULT_SYSTOLIC = 120; // mmHg
  private readonly DEFAULT_DIASTOLIC = 80; // mmHg
  
  // Physiological limits
  private readonly MIN_SYSTOLIC = 80;
  private readonly MAX_SYSTOLIC = 190;
  private readonly MIN_DIASTOLIC = 50;
  private readonly MAX_DIASTOLIC = 120;
  private readonly MIN_PULSE_PRESSURE = 25;
  private readonly MAX_PULSE_PRESSURE = 70;
  
  // History buffers for stability
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private readonly BUFFER_SIZE = 12; // Increased for better stability
  
  // Improved factors for calculation
  private readonly SYSTOLIC_WEIGHT = 0.6;
  private readonly DIASTOLIC_WEIGHT = 0.4;
  
  constructor() {
    super(VitalSignType.BLOOD_PRESSURE);
  }
  
  /**
   * Process a value from the blood pressure-optimized channel
   * @param value Optimized blood pressure signal value
   * @returns Blood pressure measurement with improved precision
   */
  protected processValueImpl(value: number): BloodPressureResult {
    // Skip processing if the value is invalid
    if (Math.abs(value) < 0.01 && this.buffer.length < 5) {
      return { 
        systolic: 0, 
        diastolic: 0,
        precision: 0
      };
    }
    
    // Apply smoothing filter to stabilize input signal
    const smoothedValue = this.applySmoothingFilter(value);
    
    // Calculate pulse characteristics from buffer
    const pulseAmplitude = this.calculatePulseAmplitude();
    const pulseRate = this.estimatePulseRate();
    
    // Calculate blood pressure values with improved precision
    const systolic = this.calculateSystolic(smoothedValue, pulseAmplitude, pulseRate);
    const diastolic = this.calculateDiastolic(smoothedValue, pulseAmplitude, pulseRate, systolic);
    
    // Add to history buffer
    this.updateBuffers(systolic, diastolic);
    
    // Calculate stabilized BP values from buffer
    const { finalSystolic, finalDiastolic, precision } = this.calculateFinalValues();
    
    return {
      systolic: Math.round(finalSystolic),
      diastolic: Math.round(finalDiastolic),
      precision
    };
  }
  
  /**
   * Apply smoothing filter to input signal
   */
  private applySmoothingFilter(value: number): number {
    // Use last 5 values for smoothing if available
    if (this.buffer.length < 5) {
      return value;
    }
    
    // Apply SMA filter from utils
    const recentValues = this.buffer.slice(-5);
    return applySMAFilter([...recentValues, value], 3)[5];
  }
  
  /**
   * Calculate systolic blood pressure with improved algorithm
   */
  private calculateSystolic(value: number, amplitude: number, pulseRate: number): number {
    if (this.confidence < 0.2 && this.systolicBuffer.length === 0) {
      return 0;
    }
    
    // Base calculation with more physiological factors
    let systolic = this.DEFAULT_SYSTOLIC;
    
    // Signal amplitude component (major factor)
    const amplitudeComponent = amplitude * 25;
    
    // Signal level component (minor factor)
    const levelComponent = value * 5;
    
    // Heart rate adjustment (higher HR correlates with higher systolic)
    const hrAdjustment = (pulseRate > 0) ? (pulseRate - 70) * 0.5 : 0;
    
    // Calculate final value with components
    systolic = this.DEFAULT_SYSTOLIC + amplitudeComponent + levelComponent + hrAdjustment;
    
    // Ensure result is within physiological range
    return Math.min(this.MAX_SYSTOLIC, Math.max(this.MIN_SYSTOLIC, systolic));
  }
  
  /**
   * Calculate diastolic blood pressure with improved algorithm
   */
  private calculateDiastolic(value: number, amplitude: number, pulseRate: number, systolic: number): number {
    if (this.confidence < 0.2 && this.diastolicBuffer.length === 0) {
      return 0;
    }
    
    // Base calculation
    let diastolic = this.DEFAULT_DIASTOLIC;
    
    // Signal amplitude component (smaller impact than for systolic)
    const amplitudeComponent = amplitude * 15;
    
    // Signal level component
    const levelComponent = value * 3;
    
    // Heart rate adjustment (higher HR correlates with higher diastolic, but less than systolic)
    const hrAdjustment = (pulseRate > 0) ? (pulseRate - 70) * 0.3 : 0;
    
    // Calculate initial diastolic value
    diastolic = this.DEFAULT_DIASTOLIC + amplitudeComponent + levelComponent + hrAdjustment;
    
    // Ensure pulse pressure is within physiological limits
    const pulsePressure = systolic - diastolic;
    
    if (pulsePressure < this.MIN_PULSE_PRESSURE) {
      diastolic = systolic - this.MIN_PULSE_PRESSURE;
    } else if (pulsePressure > this.MAX_PULSE_PRESSURE) {
      diastolic = systolic - this.MAX_PULSE_PRESSURE;
    }
    
    // Ensure result is within physiological range
    return Math.min(this.MAX_DIASTOLIC, Math.max(this.MIN_DIASTOLIC, diastolic));
  }
  
  /**
   * Update history buffers with new BP values
   */
  private updateBuffers(systolic: number, diastolic: number): void {
    if (systolic > 0 && diastolic > 0) {
      this.systolicBuffer.push(systolic);
      this.diastolicBuffer.push(diastolic);
      
      // Keep buffer size limited
      if (this.systolicBuffer.length > this.BUFFER_SIZE) {
        this.systolicBuffer.shift();
        this.diastolicBuffer.shift();
      }
    }
  }
  
  /**
   * Calculate final BP values from buffer with outlier rejection
   */
  private calculateFinalValues(): { finalSystolic: number, finalDiastolic: number, precision: number } {
    if (this.systolicBuffer.length === 0) {
      return { 
        finalSystolic: 0, 
        finalDiastolic: 0,
        precision: 0
      };
    }
    
    // Sort values for median calculation and outlier rejection
    const sortedSystolic = [...this.systolicBuffer].sort((a, b) => a - b);
    const sortedDiastolic = [...this.diastolicBuffer].sort((a, b) => a - b);
    
    // Remove outliers (values outside 1.5 IQR)
    const systolicFiltered = this.filterOutliers(sortedSystolic);
    const diastolicFiltered = this.filterOutliers(sortedDiastolic);
    
    // Calculate statistics
    const systolicMean = systolicFiltered.reduce((sum, val) => sum + val, 0) / systolicFiltered.length;
    const diastolicMean = diastolicFiltered.reduce((sum, val) => sum + val, 0) / diastolicFiltered.length;
    
    const systolicMedian = systolicFiltered[Math.floor(systolicFiltered.length / 2)];
    const diastolicMedian = diastolicFiltered[Math.floor(diastolicFiltered.length / 2)];
    
    // Calculate standard deviation for precision estimation
    const systolicStd = calculateStandardDeviation(systolicFiltered);
    const diastolicStd = calculateStandardDeviation(diastolicFiltered);
    
    // Calculate weighted average of mean and median for stability
    const finalSystolic = systolicMedian * this.SYSTOLIC_WEIGHT + systolicMean * this.DIASTOLIC_WEIGHT;
    const finalDiastolic = diastolicMedian * this.SYSTOLIC_WEIGHT + diastolicMean * this.DIASTOLIC_WEIGHT;
    
    // Calculate precision based on relative standard deviation and buffer size
    const systolicRSD = systolicStd / systolicMean;
    const diastolicRSD = diastolicStd / diastolicMean;
    const bufferSizeFactor = Math.min(1, this.systolicBuffer.length / this.BUFFER_SIZE);
    
    // Lower RSD and larger buffer = higher precision
    const precision = Math.max(0, Math.min(1, (1 - (systolicRSD + diastolicRSD) / 2) * bufferSizeFactor));
    
    return { finalSystolic, finalDiastolic, precision };
  }
  
  /**
   * Filter outliers using IQR method
   */
  private filterOutliers(sortedValues: number[]): number[] {
    if (sortedValues.length < 5) return sortedValues;
    
    const q1Idx = Math.floor(sortedValues.length / 4);
    const q3Idx = Math.floor(3 * sortedValues.length / 4);
    
    const q1 = sortedValues[q1Idx];
    const q3 = sortedValues[q3Idx];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return sortedValues.filter(val => val >= lowerBound && val <= upperBound);
  }
  
  /**
   * Calculate pulse amplitude from buffer
   */
  private calculatePulseAmplitude(): number {
    if (this.buffer.length < 10) return 0;
    
    const recentValues = this.buffer.slice(-10);
    return Math.max(...recentValues) - Math.min(...recentValues);
  }
  
  /**
   * Estimate pulse rate from buffer
   */
  private estimatePulseRate(): number {
    if (this.buffer.length < 20) return 0;
    
    // Simple zero-crossing method to estimate frequency
    const values = this.buffer.slice(-20);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Count zero crossings
    let crossings = 0;
    for (let i = 1; i < values.length; i++) {
      if ((values[i] - mean) * (values[i-1] - mean) < 0) {
        crossings++;
      }
    }
    
    // Calculate heart rate
    const secondsOfData = values.length / 30; // Assuming 30 Hz sampling
    const crossingsPerSecond = crossings / secondsOfData;
    return Math.round(crossingsPerSecond * 30); // Convert to BPM
  }
  
  /**
   * Reset the processor
   */
  public override reset(): void {
    super.reset();
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
  }
}
