
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { ArrhythmiaPatternDetector } from './arrhythmia/pattern-detector';
import { calculateRMSSD, calculateRRVariation, detectConsecutiveVariation } from './arrhythmia/calculations';
import { RRIntervalData, ArrhythmiaProcessingResult } from './arrhythmia/types';

/**
 * Consolidated arrhythmia detection system
 * Using only real data without simulation
 */
export class ArrhythmiaProcessor {
  // DRÁSTICAMENTE REDUCIDOS PARA MAYOR SENSIBILIDAD
  private readonly MIN_RR_INTERVALS = 4; // Reducido de 8 a 4
  private readonly MIN_INTERVAL_MS = 500; // Reducido de 600 a 500
  private readonly MAX_INTERVAL_MS = 1500; // Aumentado de 1200 a 1500
  private readonly MIN_VARIATION_PERCENT = 30; // Reducido de 50 a 30
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 5000; // Reducido de 10000 a 5000
  
  // State
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastArrhythmiaTime: number = 0;
  private startTime: number = Date.now();
  
  // Arrhythmia confirmation sequence - DRÁSTICAMENTE REDUCIDOS
  private consecutiveAbnormalBeats = 0;
  private readonly CONSECUTIVE_THRESHOLD = 1; // Reducido de 5 a 1
  
  // Pattern detector
  private patternDetector = new ArrhythmiaPatternDetector();

  /**
   * Process real RR data for arrhythmia detection
   * No simulation is used
   */
  public processRRData(rrData?: RRIntervalData): ArrhythmiaProcessingResult {
    const currentTime = Date.now();
    
    // Forzar detección para fines de depuración
    const forceDetection = false; // Cambiar a true para forzar detección

    // Update RR intervals with real data
    if (rrData?.intervals && rrData.intervals.length > 0) {
      this.rrIntervals = rrData.intervals;
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Process with much less strict conditions
      if (this.rrIntervals.length >= this.MIN_RR_INTERVALS || forceDetection) {
        this.detectArrhythmia(currentTime);
      }
    }

    // Use RRVariation directly from calculations.ts
    if (this.rrIntervals.length >= 3) {
      // Use the detection function directly
      const hasPatternVariation = detectConsecutiveVariation(this.rrIntervals);
      if (hasPatternVariation && !this.arrhythmiaDetected && 
          currentTime - this.lastArrhythmiaTime > 5000) {
        this.arrhythmiaCount++;
        this.arrhythmiaDetected = true;
        this.lastArrhythmiaTime = currentTime;
      }
    }

    // Build status message
    const arrhythmiaStatusMessage = 
      this.arrhythmiaDetected 
        ? `ARRHYTHMIA DETECTED|${this.arrhythmiaCount}` 
        : `NO ARRHYTHMIAS|${this.arrhythmiaCount}`;
    
    // Siempre proporcionar datos para que los consumidores tengan información
    const lastArrhythmiaData = {
      timestamp: currentTime,
      rmssd: this.rrIntervals.length >= 2 ? calculateRMSSD(this.rrIntervals.slice(-8)) : 0,
      rrVariation: this.rrIntervals.length >= 2 ? calculateRRVariation(this.rrIntervals.slice(-8)) : 0
    };
    
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
    
    // Filter only physiologically valid intervals with wider range
    const validIntervals = recentRR.filter(interval => 
      interval >= this.MIN_INTERVAL_MS && interval <= this.MAX_INTERVAL_MS
    );
    
    // Require fewer valid intervals
    if (validIntervals.length < this.MIN_RR_INTERVALS * 0.5) { // Reducido de 0.6 a 0.5
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
    
    // Detect premature beat with lower threshold
    const prematureBeat = variation > this.MIN_VARIATION_PERCENT;
    
    // Update consecutive anomalies counter
    if (prematureBeat) {
      this.consecutiveAbnormalBeats++;
      
      // Log detection
      console.log("ArrhythmiaProcessor: Possible premature beat in real data", {
        percentageVariation: variation,
        threshold: this.MIN_VARIATION_PERCENT,
        consecutive: this.consecutiveAbnormalBeats,
        avgRR,
        lastRR,
        timestamp: currentTime
      });
    } else {
      this.consecutiveAbnormalBeats = Math.max(0, this.consecutiveAbnormalBeats - 1);
    }
    
    // Check if arrhythmia is confirmed with real data - much more sensitive now
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const canDetectNewArrhythmia = timeSinceLastArrhythmia > this.MIN_ARRHYTHMIA_INTERVAL_MS;
    const patternDetected = this.patternDetector.detectArrhythmiaPattern();
    
    // Much more sensitive detection
    if ((this.consecutiveAbnormalBeats >= this.CONSECUTIVE_THRESHOLD || patternDetected) && canDetectNewArrhythmia) {
      this.arrhythmiaCount++;
      this.arrhythmiaDetected = true;
      this.lastArrhythmiaTime = currentTime;
      this.consecutiveAbnormalBeats = 0;
      
      console.log("ArrhythmiaProcessor: ARRHYTHMIA CONFIRMED in real data", {
        arrhythmiaCount: this.arrhythmiaCount,
        timeSinceLast: timeSinceLastArrhythmia,
        timestamp: currentTime,
        patternDetected,
        consecutiveBeats: this.consecutiveAbnormalBeats
      });
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
