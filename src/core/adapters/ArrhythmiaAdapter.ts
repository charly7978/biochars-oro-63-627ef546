
import { ArrhythmiaDetector, ArrhythmiaData, ArrhythmiaResult } from '../analysis/ArrhythmiaDetector';
import { RRData } from '../signal/PeakDetector';

// Common interface for all arrhythmia processing results
export interface StandardArrhythmiaResult {
  arrhythmiaStatus: string;
  lastArrhythmiaData: ArrhythmiaData | null;
  count: number;
}

/**
 * Adapter that standardizes access to various arrhythmia detection implementations
 * This allows us to gradually migrate to a unified implementation
 */
export class ArrhythmiaAdapter {
  private coreDetector: ArrhythmiaDetector;
  
  constructor() {
    this.coreDetector = new ArrhythmiaDetector();
  }
  
  /**
   * Process RR intervals to detect arrhythmias
   */
  public processRRData(rrData?: RRData | { intervals: number[]; lastPeakTime: number | null }): StandardArrhythmiaResult {
    // Use the core implementation
    const result = this.coreDetector.processRRData(rrData as RRData);
    
    // Format the result according to the standard interface
    return {
      arrhythmiaStatus: this.formatArrhythmiaStatus(result),
      lastArrhythmiaData: result.lastArrhythmiaData,
      count: result.count
    };
  }
  
  /**
   * Format arrhythmia status in the standardized format
   */
  private formatArrhythmiaStatus(result: ArrhythmiaResult): string {
    if (result.arrhythmiaStatus === 'normal') {
      return `NO ARRHYTHMIAS|${result.count}`;
    } else {
      return `ARRHYTHMIA DETECTED|${result.count}`;
    }
  }
  
  /**
   * Get the current count of detected arrhythmias
   */
  public getArrhythmiaCount(): number {
    return this.coreDetector.getArrhythmiaCount();
  }
  
  /**
   * Reset the arrhythmia detector
   */
  public reset(): void {
    this.coreDetector.reset();
  }
}
