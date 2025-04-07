
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Signal filtering utilities for processing real PPG signals
 * All methods work with real data only, no simulation
 */
import { applySMAFilter } from '../utils/filter-utils';

export class SignalFilter {
  private readonly SMA_WINDOW_SIZE = 5;
  private readonly MEDIAN_WINDOW_SIZE = 3;
  private readonly LOW_PASS_ALPHA = 0.2;
  private smaFilterBuffer: number[] = [];
  
  /**
   * Apply Moving Average filter to real values
   */
  public applySMAFilter(value: number, values: number[]): number {
    // Ensure values is an array
    const safeValues = Array.isArray(values) ? values : [];
    const windowSize = this.SMA_WINDOW_SIZE;
    
    if (safeValues.length < windowSize) {
      return value;
    }
    
    // Use the updated applySMAFilter function
    const result = applySMAFilter(value, this.smaFilterBuffer, windowSize);
    this.smaFilterBuffer = result.updatedBuffer;
    return result.filteredValue;
  }
  
  /**
   * Apply Exponential Moving Average filter to real data
   */
  public applyEMAFilter(value: number, values: number[], alpha: number = this.LOW_PASS_ALPHA): number {
    // Ensure values is an array
    const safeValues = Array.isArray(values) ? values : [];
    
    if (safeValues.length === 0) {
      return value;
    }
    
    const lastValue = safeValues[safeValues.length - 1];
    return alpha * value + (1 - alpha) * lastValue;
  }
  
  /**
   * Apply median filter to real data
   */
  public applyMedianFilter(value: number, values: number[]): number {
    // Ensure values is an array
    const safeValues = Array.isArray(values) ? values : [];
    
    if (safeValues.length < this.MEDIAN_WINDOW_SIZE) {
      return value;
    }
    
    const valuesForMedian = [...safeValues.slice(-this.MEDIAN_WINDOW_SIZE), value];
    valuesForMedian.sort((a, b) => a - b);
    
    return valuesForMedian[Math.floor(valuesForMedian.length / 2)];
  }
  
  /**
   * Reset all filter buffers
   */
  public reset(): void {
    this.smaFilterBuffer = [];
  }
}
