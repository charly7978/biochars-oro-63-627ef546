
/**
 * Legacy arrhythmia detector component
 * Handles RR interval analysis and arrhythmia detection
 */

import { ProcessorConfig } from '../../vital-signs/ProcessorConfig';

export class LegacyArrhythmiaDetector {
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private baselineRhythm: number = 0;
  private isLearningPhaseState: boolean = true;
  private arrhythmiaDetectedState: boolean = false;
  
  /**
   * Update RR intervals data from external source
   */
  public updateRRData(rrData: { intervals: number[]; lastPeakTime: number | null }): void {
    this.rrIntervals = [...rrData.intervals];
    this.lastPeakTime = rrData.lastPeakTime;
  }
  
  /**
   * Detect arrhythmias in the current RR intervals
   */
  public detectArrhythmia(): void {
    if (this.rrIntervals.length < ProcessorConfig.RR_WINDOW_SIZE) {
      console.log("VitalSignsProcessor: Insufficient RR intervals for RMSSD", {
        current: this.rrIntervals.length,
        needed: ProcessorConfig.RR_WINDOW_SIZE
      });
      return;
    }

    const recentRR = this.rrIntervals.slice(-ProcessorConfig.RR_WINDOW_SIZE);
    
    let sumSquaredDiff = 0;
    for (let i = 1; i < recentRR.length; i++) {
      const diff = recentRR[i] - recentRR[i-1];
      sumSquaredDiff += diff * diff;
    }
    
    const rmssd = Math.sqrt(sumSquaredDiff / (recentRR.length - 1));
    
    const avgRR = recentRR.reduce((a, b) => a + b, 0) / recentRR.length;
    const lastRR = recentRR[recentRR.length - 1];
    const prematureBeat = Math.abs(lastRR - avgRR) > (avgRR * 0.25);
    
    console.log("VitalSignsProcessor: RMSSD Analysis", {
      timestamp: new Date().toISOString(),
      rmssd,
      threshold: ProcessorConfig.RMSSD_THRESHOLD,
      recentRR,
      avgRR,
      lastRR,
      prematureBeat
    });

    const newArrhythmiaState = rmssd > ProcessorConfig.RMSSD_THRESHOLD && prematureBeat;

    if (newArrhythmiaState !== this.arrhythmiaDetectedState) {
      this.arrhythmiaDetectedState = newArrhythmiaState;
      console.log("VitalSignsProcessor: Arrhythmia state change", {
        previousState: !this.arrhythmiaDetectedState,
        newState: this.arrhythmiaDetectedState,
        cause: {
          rmssdExceeded: rmssd > ProcessorConfig.RMSSD_THRESHOLD,
          prematureBeat,
          rmssdValue: rmssd
        }
      });
    }
  }
  
  /**
   * Get current arrhythmia status text based on detection state
   */
  public getArrhythmiaStatus(measurementStartTime: number): string {
    let arrhythmiaStatus = "--";
    
    const currentTime = Date.now();
    const timeSinceStart = currentTime - measurementStartTime;

    // After learning period, report arrhythmia status
    if (timeSinceStart > ProcessorConfig.ARRHYTHMIA_LEARNING_PERIOD) {
      this.isLearningPhaseState = false;
      arrhythmiaStatus = this.arrhythmiaDetectedState ? "ARRHYTHMIA DETECTED" : "NO ARRHYTHMIAS";
    }
    
    return arrhythmiaStatus;
  }
  
  /**
   * Check if still in learning phase
   */
  public isLearningPhase(): boolean {
    return this.isLearningPhaseState;
  }
  
  /**
   * Check if arrhythmia is currently detected
   */
  public isArrhythmiaDetected(): boolean {
    return this.arrhythmiaDetectedState;
  }
  
  /**
   * Get the count of current RR intervals
   */
  public getRRIntervalsCount(): number {
    return this.rrIntervals.length;
  }
  
  /**
   * Reset the arrhythmia detector state
   */
  public reset(): void {
    this.rrIntervals = [];
    this.lastPeakTime = null;
    this.baselineRhythm = 0;
    this.isLearningPhaseState = true;
    this.arrhythmiaDetectedState = false;
  }
}
