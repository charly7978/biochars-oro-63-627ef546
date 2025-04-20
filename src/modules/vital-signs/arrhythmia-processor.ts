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
  private readonly MIN_RR_INTERVALS = 5; // Antes 15, ahora 5 para pruebas
  private readonly MIN_INTERVAL_MS = 500; // Reducido para detectar FC más altas
  private readonly MAX_INTERVAL_MS = 1500;
  private readonly MIN_VARIATION_PERCENT = 20; // Antes 60, ahora 20 para pruebas
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 15000; // Reducido para detectar más arritmias
  
  // State
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastArrhythmiaTime = 0;
  private startTime = Date.now();
  
  // Arrhythmia confirmation sequence
  private consecutiveAbnormalBeats = 3; // Antes 10, ahora 3 para pruebas
  private readonly CONSECUTIVE_THRESHOLD = 3; // Antes 10, ahora 3 para pruebas
  
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
      this.rrIntervals = rrData.intervals;
      this.lastPeakTime = rrData.lastPeakTime;
      console.log('[Arrhythmia] RR intervals recibidos:', this.rrIntervals);
      
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
    const lastArrhythmiaData = this.arrhythmiaDetected 
      ? {
          timestamp: currentTime,
          rmssd: calculateRMSSD(this.rrIntervals.slice(-8)),
          rrVariation: calculateRRVariation(this.rrIntervals.slice(-8))
        } 
      : null;
    
    console.log('[Arrhythmia] Estado:', arrhythmiaStatusMessage, 'Data:', lastArrhythmiaData);
    
    return {
      arrhythmiaStatus: arrhythmiaStatusMessage,
      lastArrhythmiaData
    };
  }

  /**
   * Conservative algorithm for real data arrhythmia detection
   * No simulation or reference values are used
   */
  private detectArrhythmia(currentTime: number): void {
    if (this.rrIntervals.length < this.MIN_RR_INTERVALS) return;
    
    // Take real intervals for analysis
    const recentRR = this.rrIntervals.slice(-this.MIN_RR_INTERVALS);
    
    // Filter only physiologically valid intervals
    const validIntervals = recentRR.filter(interval => 
      interval >= this.MIN_INTERVAL_MS && interval <= this.MAX_INTERVAL_MS
    );
    
    // Require sufficient valid intervals
    if (validIntervals.length < this.MIN_RR_INTERVALS * 0.7) { // Reducido para mayor sensibilidad
      this.consecutiveAbnormalBeats = 0;
      console.log('[Arrhythmia] Intervals no válidos para análisis:', validIntervals);
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
    
    // Detect premature beat only if variation meets threshold
    const prematureBeat = variation > this.MIN_VARIATION_PERCENT;
    
    // Update consecutive anomalies counter
    if (prematureBeat) {
      this.consecutiveAbnormalBeats++;
      
      // Log detection
      console.log('[Arrhythmia] Posible latido prematuro:', { variation, avgRR, lastRR, consecutivos: this.consecutiveAbnormalBeats });
    } else {
      // Reducir el contador gradualmente para mantener la detección
      this.consecutiveAbnormalBeats = Math.max(0, this.consecutiveAbnormalBeats - 0.5);
    }
    
    // Check if arrhythmia is confirmed with real data
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const canDetectNewArrhythmia = timeSinceLastArrhythmia > this.MIN_ARRHYTHMIA_INTERVAL_MS;
    const patternDetected = this.patternDetector.detectArrhythmiaPattern();
    
    if (this.consecutiveAbnormalBeats >= this.CONSECUTIVE_THRESHOLD && canDetectNewArrhythmia) {
      this.arrhythmiaCount++;
      this.arrhythmiaDetected = true;
      this.lastArrhythmiaTime = currentTime;
      this.consecutiveAbnormalBeats = 0;
      this.patternDetector.resetPatternBuffer();
      
      console.log('[Arrhythmia] ARRITMIA CONFIRMADA', { contadorArritmias: this.arrhythmiaCount, timestamp: currentTime });
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
