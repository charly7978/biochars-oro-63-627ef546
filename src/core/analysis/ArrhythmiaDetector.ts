
import { RRData } from '../signal/PeakDetector';

export interface ArrhythmiaResult {
  arrhythmiaStatus: 'normal' | 'possible-arrhythmia' | 'bigeminy' | 'tachycardia' | 'bradycardia';
  lastArrhythmiaData: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
    category?: string;
  } | null;
  count: number;
  debugLog?: string[];
}

interface UserProfile {
  age: number;
  condition?: 'athlete' | 'hypertension' | 'diabetes';
}

export class ArrhythmiaDetector {
  private RMSSD_THRESHOLD = 35;
  private RR_VARIATION_THRESHOLD = 0.17;
  private readonly MIN_TIME_BETWEEN_ARRHYTHMIAS = 3000; // ms
  private readonly MAX_ARRHYTHMIAS_PER_SESSION = 10;
  private readonly REQUIRED_RR_INTERVALS = 5;
  private readonly LEARNING_PERIOD = 4000; // ms

  private lastArrhythmiaTime: number = 0;
  private arrhythmiaCounter: number = 0;
  private isLearningPhase: boolean = true;
  private measurementStartTime: number = Date.now();
  private lastRMSSD: number = 0;
  private lastRRVariation: number = 0;
  private lastArrhythmiaData: ArrhythmiaResult['lastArrhythmiaData'] = null;
  private debugLog: string[] = [];

  constructor(private userProfile: UserProfile = { age: 30 }) {
    this.adjustThresholds();
    this.reset();
  }

  private adjustThresholds() {
    const { age, condition } = this.userProfile;

    if (age > 60) {
      this.RMSSD_THRESHOLD *= 0.85;
      this.RR_VARIATION_THRESHOLD *= 0.9;
    }
    if (condition === 'athlete') {
      this.RMSSD_THRESHOLD *= 1.1;
    }
    if (condition === 'hypertension') {
      this.RR_VARIATION_THRESHOLD *= 0.95;
    }
  }

  public processRRData(rrData?: RRData): ArrhythmiaResult {
    const currentTime = Date.now();
    if (this.isLearningPhase && currentTime - this.measurementStartTime > this.LEARNING_PERIOD) {
      this.isLearningPhase = false;
    }

    if (!rrData || !rrData.intervals || rrData.intervals.length < this.REQUIRED_RR_INTERVALS) {
      return this.buildResult('normal');
    }

    const rmssd = this.calculateRMSSD(rrData.intervals);
    const avgRR = rrData.intervals.reduce((sum, val) => sum + val, 0) / rrData.intervals.length;
    const rrVariation = this.calculateRRVariation(rrData.intervals, avgRR);

    this.lastRMSSD = rmssd;
    this.lastRRVariation = rrVariation;

    let hasArrhythmia = false;
    let category: ArrhythmiaResult['arrhythmiaStatus'] = 'normal';

    if (!this.isLearningPhase &&
        rmssd > this.RMSSD_THRESHOLD &&
        rrVariation > this.RR_VARIATION_THRESHOLD) {

      const timeSinceLast = currentTime - this.lastArrhythmiaTime;
      if (timeSinceLast > this.MIN_TIME_BETWEEN_ARRHYTHMIAS &&
          this.arrhythmiaCounter < this.MAX_ARRHYTHMIAS_PER_SESSION) {

        hasArrhythmia = true;
        category = this.categorizeArrhythmia(rrData.intervals, avgRR);
        this.lastArrhythmiaTime = currentTime;
        this.arrhythmiaCounter++;

        this.lastArrhythmiaData = {
          timestamp: currentTime,
          rmssd,
          rrVariation,
          category
        };
        this.debugLog.push(`Arrhythmia detected at ${currentTime} - ${category}`);
      }
    }

    return this.buildResult(category);
  }

  private categorizeArrhythmia(intervals: number[], avgRR: number): ArrhythmiaResult['arrhythmiaStatus'] {
    const last = intervals[intervals.length - 1];
    if (last < 500) return 'tachycardia';
    if (last > 1200) return 'bradycardia';

    const variation = Math.abs(intervals[intervals.length - 1] - intervals[intervals.length - 2]);
    if (variation > avgRR * 0.2) return 'bigeminy';

    return 'possible-arrhythmia';
  }

  private buildResult(category: ArrhythmiaResult['arrhythmiaStatus']): ArrhythmiaResult {
    return {
      arrhythmiaStatus: category,
      lastArrhythmiaData: this.lastArrhythmiaData,
      count: this.arrhythmiaCounter,
      debugLog: [...this.debugLog]
    };
  }

  private calculateRMSSD(intervals: number[]): number {
    const diffs = intervals.slice(1).map((val, i) => val - intervals[i]);
    const squared = diffs.map(d => d * d);
    const mean = squared.reduce((sum, val) => sum + val, 0) / squared.length;
    return Math.sqrt(mean);
  }

  private calculateRRVariation(intervals: number[], avg: number): number {
    const deviations = intervals.map(i => Math.abs(i - avg));
    const meanDev = deviations.reduce((sum, val) => sum + val, 0) / deviations.length;
    return meanDev / avg;
  }

  public reset(): void {
    this.lastArrhythmiaTime = 0;
    this.arrhythmiaCounter = 0;
    this.isLearningPhase = true;
    this.measurementStartTime = Date.now();
    this.lastRMSSD = 0;
    this.lastRRVariation = 0;
    this.lastArrhythmiaData = null;
    this.debugLog = [];
  }

  public getDebugLog(): string[] {
    return [...this.debugLog];
  }
  
  // Add this method to match the one expected by VitalSignsProcessor
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCounter;
  }
}
