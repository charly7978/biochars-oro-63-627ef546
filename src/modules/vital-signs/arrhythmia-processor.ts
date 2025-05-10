/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { ArrhythmiaPatternDetector } from './arrhythmia/pattern-detector';
import { calculateRMSSD, calculateRRVariation } from './arrhythmia/calculations';
import { RRIntervalData, ArrhythmiaProcessingResult } from './arrhythmia/types';

/**
 * Consolidated arrhythmia detection system
 * Using only real data without simulation
 */
export class ArrhythmiaProcessor {
  // Conservative thresholds for direct measurement
  private readonly MIN_RR_INTERVALS = 15; // Reducido para detectar antes
  private readonly MIN_INTERVAL_MS = 500; // Reducido para detectar FC más altas
  private readonly MAX_INTERVAL_MS = 1500;
  private readonly MIN_VARIATION_PERCENT = 60; // Reducido para mayor sensibilidad
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 15000; // Reducido para detectar más arritmias
  
  // State
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastArrhythmiaTime: number = 0;
  private startTime: number = Date.now();
  
  // Arrhythmia confirmation sequence
  private consecutiveAbnormalBeats = 0;
  private readonly CONSECUTIVE_THRESHOLD = 10; // Reducido para detectar antes
  
  // Pattern detector
  private patternDetector = new ArrhythmiaPatternDetector();

  /**
   * Process real RR data for arrhythmia detection
   * No simulation is used
   */
  public processRRData(rrData?: RRIntervalData): ArrhythmiaProcessingResult {
    const currentTime = Date.now();
    
    // Update RR intervals with real data
    if (rrData?.intervals && rrData.intervals.length > 0) {
      console.log(`ArrhythmiaProcessor (processRRData): Received ${rrData.intervals.length} rrIntervals. Sample: ${JSON.stringify(rrData.intervals.slice(0,5))}`); // LOG AP.1
      this.rrIntervals = rrData.intervals;
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Only proceed with sufficient real data
      if (this.rrIntervals.length >= this.MIN_RR_INTERVALS) {
        this.detectArrhythmia(currentTime);
      }
    }

    // Build status message
    const arrhythmiaStatusMessage = 
      this.arrhythmiaCount > 0 
        ? `ARRHYTHMIA DETECTED|${this.arrhythmiaCount}` 
        : `NO ARRHYTHMIAS|${this.arrhythmiaCount}`;
    
    // Additional information only if there's active arrhythmia
    const currentArrhythmiaData = this.arrhythmiaDetected 
      ? {
          timestamp: currentTime,
          rmssd: calculateRMSSD(this.rrIntervals.slice(-8)),
          rrVariation: calculateRRVariation(this.rrIntervals.slice(-8))
        } 
      : null;
    
    const resultForLog = {
      arrhythmiaStatus: arrhythmiaStatusMessage,
      lastArrhythmiaData: currentArrhythmiaData
    };
    console.log("ArrhythmiaProcessor (processRRData): Returning result:", JSON.stringify(resultForLog)); // LOG AP.2
    return resultForLog;
  }

  /**
   * Conservative algorithm for real data arrhythmia detection
   * No simulation or reference values are used
   */
  private detectArrhythmia(currentTime: number): void {
    if (this.rrIntervals.length < this.MIN_RR_INTERVALS) {
      console.log(`ArrhythmiaProcessor (detectArrhythmia): Not enough RR intervals. Got ${this.rrIntervals.length}, need ${this.MIN_RR_INTERVALS}`); // LOG AP.3
      return;
    }
    console.log(`ArrhythmiaProcessor (detectArrhythmia): Processing ${this.rrIntervals.length} intervals. Sample: ${JSON.stringify(this.rrIntervals.slice(-5))}`); // LOG AP.4
    
    // Take real intervals for analysis
    const recentRR = this.rrIntervals.slice(-this.MIN_RR_INTERVALS);
    
    // Filter only physiologically valid intervals
    const validIntervals = recentRR.filter(interval => 
      interval >= this.MIN_INTERVAL_MS && interval <= this.MAX_INTERVAL_MS
    );
    
    // Require sufficient valid intervals
    if (validIntervals.length < this.MIN_RR_INTERVALS * 0.7) { // Reducido para mayor sensibilidad
      this.consecutiveAbnormalBeats = 0;
      return;
    }
    
    // Calculate average from real intervals
    const avgRR = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    
    // Get the last real interval
    const lastRR = validIntervals[validIntervals.length - 1];
    
    // Calculate real percentage variation
    const variation = Math.abs(lastRR - avgRR) / avgRR * 100;
    
    // Update pattern buffer with real data
    this.patternDetector.updatePatternBuffer(variation / 100);
    const patternDetected = this.patternDetector.detectArrhythmiaPattern();
    
    // Detect premature beat only if variation meets threshold
    const prematureBeat = variation > this.MIN_VARIATION_PERCENT;
    
    // Update consecutive anomalies counter
    if (prematureBeat) {
      this.consecutiveAbnormalBeats++;
      
      // Log detection
      console.log("ArrhythmiaProcessor: Posible latido prematuro detectado en datos reales", {
        porcentajeVariacion: variation,
        umbral: this.MIN_VARIATION_PERCENT,
        consecutivos: this.consecutiveAbnormalBeats,
        avgRR,
        lastRR,
        timestamp: currentTime
      });
    } else {
      // Reducir el contador gradualmente para mantener la detección
      this.consecutiveAbnormalBeats = Math.max(0, this.consecutiveAbnormalBeats - 0.5);
    }

    console.log("ArrhythmiaProcessor (detectArrhythmia): Detection params", { // LOG AP.5
      validIntervalsCount: validIntervals.length,
      avgRR,
      lastRR,
      variation,
      prematureBeat,
      consecutiveAbnormalBeats: this.consecutiveAbnormalBeats,
      patternDetected,
      MIN_VARIATION_PERCENT: this.MIN_VARIATION_PERCENT,
      CONSECUTIVE_THRESHOLD: this.CONSECUTIVE_THRESHOLD
    });

    // Check for arrhythmia confirmation
    if (
      (prematureBeat && this.consecutiveAbnormalBeats >= this.CONSECUTIVE_THRESHOLD) || 
      (patternDetected && this.consecutiveAbnormalBeats >= this.CONSECUTIVE_THRESHOLD / 2) // Menor umbral si el patrón es fuerte
    ) {
      if (currentTime - this.lastArrhythmiaTime > this.MIN_ARRHYTHMIA_INTERVAL_MS) {
        this.arrhythmiaDetected = true;
        this.arrhythmiaCount++;
        this.lastArrhythmiaTime = currentTime;
        this.consecutiveAbnormalBeats = 0; // Reset after confirmation
        console.log("ArrhythmiaProcessor: ARHYTHMIA DETECTED AND CONFIRMED", { // LOG AP.6
          count: this.arrhythmiaCount,
          variation,
          patternDetected,
          timestamp: currentTime
        });
      } else {
        console.log("ArrhythmiaProcessor: Arrhythmia condition met but too soon after last one."); // LOG AP.7
        this.arrhythmiaDetected = false; // No marcar si es muy pronto
      }
    } else {
      this.arrhythmiaDetected = false;
    }
  }

  /**
   * Reset the processor
   * Ensures all measurements start from zero
   */
  public reset(): void {
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.arrhythmiaDetected = false;
    this.arrhythmiaCount = 0;
    this.lastArrhythmiaTime = 0;
    this.startTime = Date.now();
    this.consecutiveAbnormalBeats = 0;
    this.patternDetector.resetPatternBuffer();
    
    console.log("ArrhythmiaProcessor: Processor reset", {
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Get current arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
}
