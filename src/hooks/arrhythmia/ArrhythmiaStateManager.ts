
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */

import { RRAnalysisResult } from './types';

/**
 * Manages the state of genuine arrhythmia detection
 * No data simulation or result manipulation
 */
export class ArrhythmiaStateManager {
  private lastArrhythmiaTime: number = 0;
  private arrhythmiaDetected: boolean = false;
  private arrhythmiaCounter: number = 0;
  private consecutiveAnomalies: number = 0;
  private readonly CONSECUTIVE_THRESHOLD = 6; // Reduced from 8 for faster detection
  
  /**
   * Get current anomaly count
   */
  public getConsecutiveAnomalies(): number {
    return this.consecutiveAnomalies;
  }
  
  /**
   * Update consecutive anomalies count based on real detection
   */
  public updateConsecutiveAnomalies(isPatternDetected: boolean): void {
    if (isPatternDetected) {
      this.consecutiveAnomalies++;
    } else {
      this.consecutiveAnomalies = 0;
    }
  }
  
  /**
   * Check if we can register a new arrhythmia based on real-time criteria
   */
  public canIncrementCounter(currentTime: number, minTimeBetween: number, maxCount: number): boolean {
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    return timeSinceLastArrhythmia >= minTimeBetween && this.arrhythmiaCounter < maxCount;
  }
  
  /**
   * Check if consecutive anomalies threshold is reached
   */
  public isThresholdReached(): boolean {
    return this.consecutiveAnomalies >= this.CONSECUTIVE_THRESHOLD;
  }
  
  /**
   * Register confirmed arrhythmia based on actual detection
   */
  public confirmArrhythmia(currentTime: number): void {
    this.arrhythmiaDetected = true;
    this.arrhythmiaCounter++;
    this.lastArrhythmiaTime = currentTime;
    this.consecutiveAnomalies = 0;
  }
  
  /**
   * Get current arrhythmia state
   */
  public getState(): {
    isArrhythmia: boolean;
    arrhythmiaCounter: number;
    lastArrhythmiaTime: number;
  } {
    return {
      isArrhythmia: this.arrhythmiaDetected,
      arrhythmiaCounter: this.arrhythmiaCounter,
      lastArrhythmiaTime: this.lastArrhythmiaTime
    };
  }
  
  /**
   * Reset state
   */
  public reset(): void {
    this.lastArrhythmiaTime = 0;
    this.arrhythmiaDetected = false;
    this.arrhythmiaCounter = 0;
    this.consecutiveAnomalies = 0;
  }
}
