
import { ArrhythmiaDetectorUnified, ArrhythmiaProcessingResult } from '../analysis/ArrhythmiaDetectorUnified';

/**
 * Adapter for unifying arrhythmia detection
 * Provides backward compatibility with existing systems
 */
export class ArrhythmiaAdapter {
  private detector: ArrhythmiaDetectorUnified;
  
  constructor() {
    this.detector = new ArrhythmiaDetectorUnified();
  }
  
  /**
   * Process RR data with the unified detector
   */
  public processRRData(rrData: { intervals: number[], lastPeakTime: number | null }): ArrhythmiaProcessingResult {
    return this.detector.processRRData(rrData);
  }
  
  /**
   * Get the count of detected arrhythmias
   */
  public getArrhythmiaCount(): number {
    return this.detector.getArrhythmiaCount();
  }
  
  /**
   * Reset the detector
   */
  public reset(): void {
    this.detector.reset();
  }
  
  /**
   * Configure the detector with custom thresholds
   */
  public configure(options: {
    rmssdThreshold?: number;
    rrVariationThreshold?: number;
    minTimeBetweenArrhythmias?: number;
    consecutiveThreshold?: number;
    requiredRRIntervals?: number;
  }): void {
    this.detector.setThresholds(options);
  }
}
