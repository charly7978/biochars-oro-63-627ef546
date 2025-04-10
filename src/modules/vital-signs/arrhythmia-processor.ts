
import { RRData } from '../../types/vital-signs';

interface ArrhythmiaResult {
  arrhythmiaStatus: string;
  confidence: number;
  type?: string;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

export class ArrhythmiaProcessor {
  private arrhythmiaCount: number = 0;
  private rrHistory: number[] = [];
  private lastNotifiedArrhythmia: number = 0;
  private readonly MIN_NOTIFICATION_INTERVAL_MS = 3000;
  private readonly MAX_HISTORY_SIZE = 20;
  private readonly AFIB_THRESHOLD = 0.18;
  private readonly PVC_THRESHOLD = 0.45;

  constructor() {
    this.reset();
  }

  /**
   * Process RR interval data to detect arrhythmias
   */
  public processRRData(rrData?: RRData): ArrhythmiaResult | null {
    if (!rrData || !rrData.intervals || rrData.intervals.length < 5) {
      return {
        arrhythmiaStatus: "--",
        confidence: 0
      };
    }

    // Get valid intervals (filter out potential noise)
    const validIntervals = this.getValidIntervals(rrData.intervals);
    
    if (validIntervals.length < 4) {
      return {
        arrhythmiaStatus: "--",
        confidence: 0
      };
    }

    // Update history
    this.updateRRHistory(validIntervals);
    
    // Calculate metrics for arrhythmia detection
    const rmssd = this.calculateRMSSD(validIntervals);
    const rrVariation = this.calculateRRVariation(validIntervals);
    
    // Check for arrhythmia patterns
    const isArrhythmia = this.detectArrhythmia(rmssd, rrVariation);
    const arrhythmiaType = this.classifyArrhythmiaType(rmssd, rrVariation);
    const confidence = this.calculateConfidence(rmssd, rrVariation);

    // Determine arrhythmia status and potentially increment counter
    if (isArrhythmia && confidence > 0.7) {
      const currentTime = Date.now();
      
      // Only count new arrhythmias with sufficient time gap
      if (currentTime - this.lastNotifiedArrhythmia > this.MIN_NOTIFICATION_INTERVAL_MS) {
        this.arrhythmiaCount++;
        this.lastNotifiedArrhythmia = currentTime;
      }
      
      return {
        arrhythmiaStatus: `ARRHYTHMIA DETECTED (${arrhythmiaType})`,
        confidence,
        type: arrhythmiaType,
        lastArrhythmiaData: {
          timestamp: Date.now(),
          rmssd,
          rrVariation
        }
      };
    }
    
    return {
      arrhythmiaStatus: `NORMAL`,
      confidence: 1 - confidence
    };
  }

  /**
   * Get the current arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }

  /**
   * Reset the processor
   */
  public reset(): void {
    this.arrhythmiaCount = 0;
    this.rrHistory = [];
    this.lastNotifiedArrhythmia = 0;
  }

  /**
   * Filter valid intervals to remove outliers
   */
  private getValidIntervals(intervals: number[]): number[] {
    if (intervals.length < 3) return intervals;
    
    // Sort intervals to find percentiles
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const quartile1Idx = Math.floor(sortedIntervals.length * 0.25);
    const quartile3Idx = Math.floor(sortedIntervals.length * 0.75);
    
    const q1 = sortedIntervals[quartile1Idx];
    const q3 = sortedIntervals[quartile3Idx];
    const iqr = q3 - q1;
    
    // Filter out extreme outliers (beyond 2.5 * IQR from quartiles)
    const lowerBound = q1 - 2.5 * iqr;
    const upperBound = q3 + 2.5 * iqr;
    
    return intervals.filter(interval => 
      interval >= lowerBound && 
      interval <= upperBound && 
      interval >= 400 && // Physiologically plausible lower bound
      interval <= 1500   // Physiologically plausible upper bound
    );
  }

  /**
   * Update the RR interval history
   */
  private updateRRHistory(intervals: number[]): void {
    this.rrHistory = [...this.rrHistory, ...intervals];
    
    // Trim to max size
    if (this.rrHistory.length > this.MAX_HISTORY_SIZE) {
      this.rrHistory = this.rrHistory.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  /**
   * Calculate Root Mean Square of Successive Differences
   */
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    let sumSquareDiffs = 0;
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i-1];
      sumSquareDiffs += diff * diff;
    }
    
    return Math.sqrt(sumSquareDiffs / (intervals.length - 1));
  }

  /**
   * Calculate variation coefficient of RR intervals
   */
  private calculateRRVariation(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    if (mean === 0) return 0;
    
    let sumSquareDiffs = 0;
    for (const interval of intervals) {
      const diff = interval - mean;
      sumSquareDiffs += diff * diff;
    }
    
    const stdDev = Math.sqrt(sumSquareDiffs / intervals.length);
    return stdDev / mean;
  }

  /**
   * Detect if metrics indicate arrhythmia
   */
  private detectArrhythmia(rmssd: number, rrVariation: number): boolean {
    // Higher RMSSD and RR Variation indicate irregular rhythm
    return rrVariation > this.AFIB_THRESHOLD || 
           (rmssd > 70 && rrVariation > 0.1);
  }

  /**
   * Classify the type of arrhythmia based on metrics
   */
  private classifyArrhythmiaType(rmssd: number, rrVariation: number): string {
    if (rrVariation > this.PVC_THRESHOLD) {
      return "PVC";
    } else if (rrVariation > this.AFIB_THRESHOLD) {
      return "AFIB";
    } else if (rmssd > 70) {
      return "OTHER";
    }
    return "MINOR";
  }

  /**
   * Calculate confidence in the arrhythmia detection
   */
  private calculateConfidence(rmssd: number, rrVariation: number): number {
    // Higher metrics = higher confidence
    const rmssdConfidence = Math.min(1, rmssd / 100);
    const variationConfidence = Math.min(1, rrVariation / 0.5);
    
    // Combine confidences - higher weight to variation which is more specific
    return 0.4 * rmssdConfidence + 0.6 * variationConfidence;
  }
}
