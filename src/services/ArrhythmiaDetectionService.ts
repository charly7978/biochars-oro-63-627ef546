
/**
 * Service for detecting arrhythmias from real PPG signals
 * NO SIMULATION OR DATA MANIPULATION ALLOWED
 */

import { ArrhythmiaProcessor } from '../modules/vital-signs/arrhythmia-processor';

class ArrhythmiaDetectionServiceClass {
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private isMonitoring: boolean = false;
  private arrhythmiaCount: number = 0;
  private arrhythmiaWindows: {start: number, end: number}[] = [];
  private lastRRIntervals: number[] = [];
  
  constructor() {
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    console.log("ArrhythmiaDetectionService: Initialized");
  }

  /**
   * Update RR intervals for processing
   */
  public updateRRIntervals(rrIntervals: number[]) {
    if (!rrIntervals || rrIntervals.length === 0) return;
    this.lastRRIntervals = [...rrIntervals];
  }

  /**
   * Process RR intervals to detect arrhythmias
   * Only processes real data without simulation
   */
  public detectArrhythmia(rrIntervals: number[]) {
    if (!this.isMonitoring || !rrIntervals || rrIntervals.length < 2) {
      return { 
        isArrhythmia: false, 
        arrhythmiaStatus: "MONITORING_INACTIVE", 
        data: null 
      };
    }

    const currentTime = Date.now();
    
    const result = this.arrhythmiaProcessor.processRRData({
      intervals: rrIntervals,
      lastPeakTime: currentTime
    });
    
    const isArrhythmiaDetected = result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED");
    
    if (isArrhythmiaDetected) {
      // Register arrhythmia window
      const windowStart = currentTime - 2000; // 2 seconds before detection
      const windowEnd = currentTime + 3000;   // 3 seconds after detection
      
      this.arrhythmiaWindows.push({
        start: windowStart,
        end: windowEnd
      });
      
      // Keep only the last 10 windows
      if (this.arrhythmiaWindows.length > 10) {
        this.arrhythmiaWindows.shift();
      }
    }
    
    return {
      isArrhythmia: isArrhythmiaDetected,
      arrhythmiaStatus: result.arrhythmiaStatus,
      data: result.lastArrhythmiaData
    };
  }

  /**
   * Set monitoring state
   */
  public setMonitoring(isActive: boolean) {
    this.isMonitoring = isActive;
    console.log("ArrhythmiaDetectionService: Monitoring " + (isActive ? "started" : "stopped"));
  }
  
  /**
   * Check if arrhythmia was detected
   */
  public isArrhythmia(): boolean {
    return this.arrhythmiaCount > 0;
  }
  
  /**
   * Get current arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaProcessor.getArrhythmiaCount();
  }

  /**
   * Reset all arrhythmia detection state
   */
  public reset() {
    this.isMonitoring = false;
    this.arrhythmiaWindows = [];
    this.arrhythmiaCount = 0;
    this.lastRRIntervals = [];
    this.arrhythmiaProcessor.reset();
  }
  
  /**
   * Get arrhythmia windows for visualization
   */
  public getArrhythmiaWindows() {
    return [...this.arrhythmiaWindows];
  }
}

// Singleton instance
const ArrhythmiaDetectionService = new ArrhythmiaDetectionServiceClass();
export default ArrhythmiaDetectionService;
