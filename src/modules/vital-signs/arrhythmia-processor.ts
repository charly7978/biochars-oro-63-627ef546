
import { ArrhythmiaAdapter } from '../../core/adapters/ArrhythmiaAdapter';
import { ArrhythmiaProcessingResult } from '../../core/analysis/ArrhythmiaDetectorUnified';
import { calculateRMSSD, calculateRRVariation } from './arrhythmia/calculations';
import { VitalSignsConfig } from '../../core/config/VitalSignsConfig';

/**
 * Arrhythmia processor that uses the unified detection system
 */
export class ArrhythmiaProcessor {
  private adapter: ArrhythmiaAdapter;
  private lastProcessingResult: ArrhythmiaProcessingResult = {
    arrhythmiaStatus: "NORMAL",
    lastArrhythmiaData: null
  };

  constructor() {
    this.adapter = new ArrhythmiaAdapter();
    
    // Configure with default values
    this.adapter.configure({
      rmssdThreshold: VitalSignsConfig.arrhythmia.THRESHOLDS.RMSSD,
      rrVariationThreshold: VitalSignsConfig.arrhythmia.THRESHOLDS.RR_VARIATION,
      minTimeBetweenArrhythmias: VitalSignsConfig.arrhythmia.TIMING.MIN_TIME_BETWEEN_ARRHYTHMIAS,
      consecutiveThreshold: VitalSignsConfig.arrhythmia.DATA.CONSECUTIVE_THRESHOLD,
      requiredRRIntervals: VitalSignsConfig.arrhythmia.DATA.REQUIRED_RR_INTERVALS
    });
  }

  /**
   * Process RR interval data to detect arrhythmias
   */
  public processRRData(rrData: { intervals: number[], lastPeakTime: number | null }): ArrhythmiaProcessingResult {
    if (!rrData || !rrData.intervals || rrData.intervals.length < VitalSignsConfig.arrhythmia.DATA.REQUIRED_RR_INTERVALS) {
      return {
        arrhythmiaStatus: "NORMAL",
        lastArrhythmiaData: null
      };
    }

    // Use the adapter to process the data
    const result = this.adapter.processRRData(rrData);
    this.lastProcessingResult = result;
    
    return result;
  }

  /**
   * Get the count of detected arrhythmias
   */
  public getArrhythmiaCount(): number {
    return this.adapter.getArrhythmiaCount();
  }

  /**
   * Reset the processor
   */
  public reset(): void {
    this.adapter.reset();
    this.lastProcessingResult = {
      arrhythmiaStatus: "NORMAL",
      lastArrhythmiaData: null
    };
  }

  /**
   * Calculate arrhythmia metrics manually for any RR intervals
   */
  public calculateArrhythmiaMetrics(intervals: number[]): { rmssd: number, rrVariation: number } {
    if (!intervals || intervals.length < 2) {
      return { rmssd: 0, rrVariation: 0 };
    }

    const rmssd = calculateRMSSD(intervals);
    const rrVariation = calculateRRVariation(intervals);

    return { rmssd, rrVariation };
  }
}
