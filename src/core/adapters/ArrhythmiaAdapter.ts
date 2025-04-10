
/**
 * Adapter for arrhythmia detection that ensures compatibility with existing code
 * while transitioning to the unified ArrhythmiaDetector.
 */

import { ArrhythmiaDetectorUnified } from '../analysis/ArrhythmiaDetectorUnified';
import { RRIntervalData } from '../types';

export class ArrhythmiaAdapter {
  private detector: ArrhythmiaDetectorUnified;
  
  constructor() {
    this.detector = new ArrhythmiaDetectorUnified();
  }
  
  /**
   * Process RR interval data and detect arrhythmias
   * Compatible with the existing arrhythmia-processor API
   */
  public processRRData(rrData?: RRIntervalData) {
    return this.detector.processRRData(rrData);
  }
  
  /**
   * Reset the detector
   */
  public reset() {
    this.detector.reset();
  }
  
  /**
   * Get current arrhythmia count
   */
  public getArrhythmiaCount() {
    return this.detector.getArrhythmiaCount();
  }
  
  /**
   * Get debug information
   */
  public getDebugLog() {
    return this.detector.getDebugLog();
  }
}
