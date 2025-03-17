
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */

import { ArrhythmiaAnalyzer } from '../hooks/arrhythmia/ArrhythmiaAnalyzer';
import { ArrhythmiaConfig } from '../hooks/arrhythmia/types';
import { RRDataProcessor } from './arrhythmia/RRDataProcessor';

/**
 * Integrated arrhythmia processor that consolidates all arrhythmia detection logic
 * into a single, optimized implementation
 */
export class ArrhythmiaProcessor {
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  
  private rrDataProcessor: RRDataProcessor;
  private analyzer: ArrhythmiaAnalyzer;
  
  constructor() {
    // Configure with reasonable defaults
    const config: ArrhythmiaConfig = {
      MIN_TIME_BETWEEN_ARRHYTHMIAS: 8000,
      MAX_ARRHYTHMIAS_PER_SESSION: 30,
      SIGNAL_QUALITY_THRESHOLD: 0.45,
      SENSITIVITY_LEVEL: 'medium'
    };
    
    this.rrDataProcessor = new RRDataProcessor();
    this.analyzer = new ArrhythmiaAnalyzer(config);
  }
  
  /**
   * Process RR interval data to detect arrhythmias
   */
  public processRRData(rrData?: { intervals: number[]; lastPeakTime: number | null }): {
    isArrhythmia: boolean;
    arrhythmiaCounter: number;
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
  } {
    // Update RR intervals if data is provided
    const hasSufficientData = this.rrDataProcessor.updateRRData(rrData);
    
    // Analyze if we have sufficient data
    if (hasSufficientData) {
      const result = this.analyzer.analyzeRRData({
        intervals: this.rrDataProcessor.getRRIntervals(),
        lastPeakTime: this.rrDataProcessor.getLastPeakTime()
      });
      
      this.arrhythmiaDetected = result.isArrhythmia;
      this.arrhythmiaCount = result.arrhythmiaCounter;
      
      // Return current status with arrhythmia data if available
      return {
        isArrhythmia: this.arrhythmiaDetected,
        arrhythmiaCounter: this.arrhythmiaCount,
        lastArrhythmiaData: result.lastArrhythmiaData
      };
    }
    
    // Provide current status if no new analysis was performed
    return {
      isArrhythmia: this.arrhythmiaDetected,
      arrhythmiaCounter: this.arrhythmiaCount,
      lastArrhythmiaData: null
    };
  }
  
  /**
   * Get current arrhythmia count
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCount;
  }
  
  /**
   * Reset analyzer state completely
   */
  public reset(): void {
    this.arrhythmiaDetected = false;
    this.arrhythmiaCount = 0;
    this.rrDataProcessor.reset();
    this.analyzer.reset();
    
    console.log("ArrhythmiaProcessor: Reset complete", {
      timestamp: new Date().toISOString()
    });
  }
}
