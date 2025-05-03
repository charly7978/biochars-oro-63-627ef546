
import { ArrhythmiaStatus, ArrhythmiaDetectionResult, ArrhythmiaListener, UserProfile } from './types';
import { ArrhythmiaWindowManager } from './ArrhythmiaWindowManager';
import { categorizeArrhythmia, realAbs } from './utils';

/**
 * Servicio para detección y análisis de arritmias en tiempo real
 * basado exclusivamente en datos reales
 */
class ArrhythmiaDetectionService {
  private static instance: ArrhythmiaDetectionService;
  private windowManager: ArrhythmiaWindowManager;
  private listeners: ArrhythmiaListener[] = [];
  private rmssdBuffer: number[] = [];
  private rrIntervals: number[] = [];
  private lastStatus: ArrhythmiaStatus = 'normal';
  private detectionCount: number = 0;
  private userProfile: UserProfile | null = null;
  private threshold: number = 0.2; // 20% variation threshold for RR intervals
  private consecutiveAbnormal: number = 0;
  private lastProcessTimestamp: number = Date.now();

  constructor() {
    this.windowManager = new ArrhythmiaWindowManager();
    console.log("ArrhythmiaDetectionService initialized");
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ArrhythmiaDetectionService {
    if (!ArrhythmiaDetectionService.instance) {
      ArrhythmiaDetectionService.instance = new ArrhythmiaDetectionService();
    }
    return ArrhythmiaDetectionService.instance;
  }

  /**
   * Add a listener to notification system
   * @param listener Function that receives ArrhythmiaDetectionResult
   */
  public addListener(listener: ArrhythmiaListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a listener from notification system
   * @param listener Function to remove
   */
  public removeListener(listener: ArrhythmiaListener): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Process an RR interval from beat detector
   * @param rrInterval Interval between heartbeats in ms
   * @param signalQuality Quality of the signal 0-100
   * @returns Detection result
   */
  public processRRInterval(rrInterval: number, signalQuality: number = 100): ArrhythmiaDetectionResult {
    if (rrInterval <= 0 || signalQuality < 50) {
      return this.createResult('unknown', 0, signalQuality, []);
    }

    // Add to intervals
    this.rrIntervals.push(rrInterval);
    if (this.rrIntervals.length > 30) {
      this.rrIntervals = this.rrIntervals.slice(-30);
    }

    return this.detectArrhythmia();
  }

  /**
   * Update RR intervals with an array of intervals
   * @param intervals Array of RR intervals
   */
  public updateRRIntervals(intervals: number[]): void {
    if (!intervals || intervals.length === 0) return;

    // Filter out invalid intervals
    const validIntervals = intervals.filter(interval => interval > 0);
    if (validIntervals.length === 0) return;

    // Update our interval buffer
    this.rrIntervals = [...this.rrIntervals, ...validIntervals];
    if (this.rrIntervals.length > 30) {
      this.rrIntervals = this.rrIntervals.slice(-30);
    }

    // If we have enough data, detect arrhythmias
    if (this.rrIntervals.length >= 3) {
      this.detectArrhythmia();
    }
  }

  /**
   * Process a segment of PPG signal for morphological analysis
   * @param ppgSegment Array of PPG values
   * @param signalQuality Signal quality 0-100
   */
  public async processPPGSegment(ppgSegment: number[], signalQuality: number = 100): Promise<ArrhythmiaDetectionResult> {
    // For now, we'll just use this to detect basic disturbances in the signal
    // In the future, this could use more advanced analysis
    
    if (ppgSegment.length < 10 || signalQuality < 50) {
      return this.createResult('unknown', 0, signalQuality, []);
    }
    
    // Placeholder: In a real implementation this would do actual PPG analysis
    // Here we just check if there are large variations in the signal
    
    let hasLargeVariation = false;
    if (ppgSegment.length > 10) {
      const slice = ppgSegment.slice(-10);
      let min = slice[0];
      let max = slice[0];
      
      for (let i = 1; i < slice.length; i++) {
        if (slice[i] < min) min = slice[i];
        if (slice[i] > max) max = slice[i];
      }
      
      const variation = max - min;
      const avg = slice.reduce((sum, val) => sum + val, 0) / slice.length;
      
      hasLargeVariation = variation > avg * 0.5;
    }
    
    const status = hasLargeVariation ? 'possible-arrhythmia' : 'normal';
    return this.createResult(status, hasLargeVariation ? 0.7 : 0.2, signalQuality, []);
  }

  /**
   * Set user profile to personalize detection
   */
  public setUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
    this.adjustThresholds();
  }

  /**
   * Adjust thresholds based on user profile
   */
  private adjustThresholds(): void {
    if (this.userProfile) {
      // Adjust based on age
      if (this.userProfile.age > 60) {
        this.threshold = 0.25; // More permissive for elderly
      } else if (this.userProfile.age < 20) {
        this.threshold = 0.15; // Stricter for younger people
      } else {
        this.threshold = 0.2; // Default for adults
      }

      // Further adjustments could be made based on other profile properties
    }
  }

  /**
   * Check if current state is recognized as arrhythmia
   */
  public isArrhythmia(): boolean {
    return this.lastStatus !== 'normal' && this.lastStatus !== 'unknown';
  }

  /**
   * Get the arrhythmia count for the session
   */
  public getArrhythmiaCount(): number {
    return this.detectionCount;
  }

  /**
   * Get all arrhythmia windows
   */
  public getArrhythmiaWindows(): any[] {
    return this.windowManager.getArrhythmiaWindows();
  }

  /**
   * Reset the service to initial state
   */
  public reset(): void {
    this.rrIntervals = [];
    this.rmssdBuffer = [];
    this.lastStatus = 'normal';
    this.detectionCount = 0;
    this.consecutiveAbnormal = 0;
    this.windowManager.clear();
    
    console.log("ArrhythmiaDetectionService reset");
  }

  /**
   * Analyze RR intervals and detect arrhythmias
   */
  public detectArrhythmia(): ArrhythmiaDetectionResult {
    if (this.rrIntervals.length < 3) {
      return this.createResult('unknown', 0, 100, this.rrIntervals);
    }

    const now = Date.now();

    // Calculate RMSSD (root mean square of successive differences)
    let rmssd = 0;
    let sumSquaredDiffs = 0;
    let abnormalIntervalCount = 0;

    for (let i = 1; i < this.rrIntervals.length; i++) {
      const diff = this.rrIntervals[i] - this.rrIntervals[i - 1];
      sumSquaredDiffs += diff * diff;

      // Check for abnormal intervals using threshold
      const ratio = this.rrIntervals[i] / this.rrIntervals[i - 1];
      if (ratio > (1 + this.threshold) || ratio < (1 - this.threshold)) {
        abnormalIntervalCount++;
      }
    }

    rmssd = Math.sqrt(sumSquaredDiffs / (this.rrIntervals.length - 1));
    this.rmssdBuffer.push(rmssd);

    if (this.rmssdBuffer.length > 10) {
      this.rmssdBuffer = this.rmssdBuffer.slice(-10);
    }

    // Calculate average RR interval
    const avgRR = this.rrIntervals.reduce((sum, val) => sum + val, 0) / this.rrIntervals.length;

    // Category based on thresholds
    let status: ArrhythmiaStatus = 'normal';
    let probability = 0;
    let category = '';

    // Get latest interval
    const lastRR = this.rrIntervals[this.rrIntervals.length - 1];

    // 1. Check for bradycardia or tachycardia
    if (avgRR > 1200) { // < 50 BPM
      status = 'bradycardia';
      probability = 0.8;
      category = 'rate';
    } else if (avgRR < 500) { // > 120 BPM
      status = 'tachycardia';
      probability = 0.8;
      category = 'rate';
    }
    // 2. Check for irregular patterns
    else if (abnormalIntervalCount >= 2) {
      // Check for specific patterns
      status = categorizeArrhythmia(this.rrIntervals);
      probability = 0.7;
      category = 'rhythm';

      // Look for A-Fib patterns
      const rrVariability = this.calculateRRVariability();
      if (rrVariability > 0.15 && abnormalIntervalCount >= 3) {
        status = 'possible-afib';
        probability = 0.75;
        category = 'afib';
      }
    }

    // Update consecutive count
    if (status !== 'normal' && status !== 'unknown') {
      this.consecutiveAbnormal++;
      if (this.consecutiveAbnormal >= 3) {
        // Confirm arrhythmia after consecutive detections
        this.detectionCount++;

        // Create an arrhythmia window with the appropriate size
        const duration = Math.min(5000, now - this.lastProcessTimestamp);
        this.windowManager.addArrhythmiaWindow(now, duration, status, this.rrIntervals.slice(), probability);
      }
    } else {
      this.consecutiveAbnormal = 0;
    }

    // Update timestamps
    this.lastProcessTimestamp = now;
    this.lastStatus = status;

    // Create and return result
    const result = this.createResult(status, probability, 100, this.rrIntervals, category);

    // Notify listeners
    this.notifyListeners(result);

    return result;
  }

  /**
   * Creates a standardized detection result
   */
  private createResult(
    status: ArrhythmiaStatus,
    probability: number,
    signalQuality: number,
    intervals: number[],
    category: string = ''
  ): ArrhythmiaDetectionResult {
    const timestamp = Date.now();
    const isArrhythmia = status !== 'normal' && status !== 'unknown';

    return {
      timestamp,
      status,
      probability,
      signalQuality,
      latestIntervals: [...intervals],
      details: {
        rmssd: this.rmssdBuffer.length > 0 ? this.rmssdBuffer[this.rmssdBuffer.length - 1] : 0,
        abnormalityCount: this.detectionCount,
        category
      },
      isArrhythmia,
      category
    };
  }

  /**
   * Notifies all registered listeners with detection result
   */
  private notifyListeners(result: ArrhythmiaDetectionResult): void {
    this.listeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error("Error in arrhythmia listener:", error);
      }
    });
  }

  /**
   * Calculate RR interval variability (for A-Fib detection)
   */
  private calculateRRVariability(): number {
    if (this.rrIntervals.length < 5) return 0;

    const intervals = this.rrIntervals.slice(-5);
    let sum = 0;
    let sumSquares = 0;

    for (const interval of intervals) {
      sum += interval;
      sumSquares += interval * interval;
    }

    const mean = sum / intervals.length;
    const variance = (sumSquares / intervals.length) - (mean * mean);
    const stdDev = Math.sqrt(variance);

    // Coefficient of variation
    return stdDev / mean;
  }
}

// Export a singleton instance
const arrhythmiaServiceInstance = ArrhythmiaDetectionService.getInstance();
export default arrhythmiaServiceInstance;
