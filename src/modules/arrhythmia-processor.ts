
import { ArrhythmiaAnalyzer } from '../hooks/arrhythmia/ArrhythmiaAnalyzer';
import { ArrhythmiaConfig } from '../hooks/arrhythmia/types';

/**
 * Integrated arrhythmia processor that consolidates all arrhythmia detection logic
 * into a single, optimized implementation
 */
export class ArrhythmiaProcessor {
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private calibrationTime: number = 10000; // 10 seconds calibration
  private isCalibrating = true;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private startTime: number = Date.now();
  
  private analyzer: ArrhythmiaAnalyzer;
  
  constructor() {
    // Configure with reasonable defaults
    const config: ArrhythmiaConfig = {
      MIN_TIME_BETWEEN_ARRHYTHMIAS: 8000,
      MAX_ARRHYTHMIAS_PER_SESSION: 30,
      SIGNAL_QUALITY_THRESHOLD: 0.45,
      SENSITIVITY_LEVEL: 'medium'
    };
    
    this.analyzer = new ArrhythmiaAnalyzer(config);
  }
  
  /**
   * Process RR interval data to detect arrhythmias
   */
  public processRRData(rrData?: { intervals: number[]; lastPeakTime: number | null }): {
    arrhythmiaStatus: string;
    lastArrhythmiaData: { timestamp: number; rmssd: number; rrVariation: number; } | null;
  } {
    const currentTime = Date.now();
    
    // Handle calibration phase
    if (this.isCalibrating && currentTime - this.startTime >= this.calibrationTime) {
      this.isCalibrating = false;
      console.log("ArrhythmiaProcessor: Calibration completed", {
        elapsedTime: currentTime - this.startTime
      });
    }
    
    if (this.isCalibrating) {
      return {
        arrhythmiaStatus: "CALIBRANDO...",
        lastArrhythmiaData: null
      };
    }
    
    // Update RR intervals if data is provided
    if (rrData?.intervals && rrData.intervals.length > 0) {
      this.rrIntervals = rrData.intervals;
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Analyze if we have sufficient data
      if (this.rrIntervals.length >= 12) {
        const result = this.analyzer.analyzeRRData(rrData);
        this.arrhythmiaDetected = result.isArrhythmia;
        this.arrhythmiaCount = result.arrhythmiaCounter;
        
        // Return current status with arrhythmia data if available
        return {
          arrhythmiaStatus: this.arrhythmiaDetected 
            ? `ARRITMIA DETECTADA|${this.arrhythmiaCount}` 
            : `NORMAL|${this.arrhythmiaCount}`,
          lastArrhythmiaData: result.lastArrhythmiaData
        };
      }
    }
    
    // Provide current status if no new analysis was performed
    return {
      arrhythmiaStatus: this.arrhythmiaDetected 
        ? `ARRITMIA DETECTADA|${this.arrhythmiaCount}` 
        : `NORMAL|${this.arrhythmiaCount}`,
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
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.isCalibrating = true;
    this.arrhythmiaDetected = false;
    this.arrhythmiaCount = 0;
    this.startTime = Date.now();
    this.analyzer.reset();
    
    console.log("ArrhythmiaProcessor: Reset complete", {
      timestamp: new Date().toISOString()
    });
  }
}
