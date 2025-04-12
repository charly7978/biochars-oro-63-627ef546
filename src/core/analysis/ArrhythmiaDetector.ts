import { calculateRMSSD, calculateRRVariation } from '@/modules/vital-signs/arrhythmia/calculations';
import { RRIntervalData, ArrhythmiaProcessingResult } from '@/core/types';

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
  private lastArrhythmiaData: ArrhythmiaProcessingResult['lastArrhythmiaData'] = null;
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

  public processRRData(rrData?: RRIntervalData): ArrhythmiaProcessingResult {
    const currentTime = Date.now();
    this.debugLog = []; // Clear log for new processing cycle

    if (this.isLearningPhase && (currentTime - this.measurementStartTime < this.LEARNING_PERIOD)) {
        this.debugLog.push(`Learning phase active (ends in ${this.LEARNING_PERIOD - (currentTime - this.measurementStartTime)}ms)`);
        // Still learning, return normal status without detailed data
        return this.buildResult('normal');
    } else if (this.isLearningPhase) {
         this.debugLog.push(`Learning phase ended.`);
        this.isLearningPhase = false; // End learning phase
    }

    if (!rrData || !rrData.intervals || rrData.intervals.length < this.REQUIRED_RR_INTERVALS) {
      this.debugLog.push(`Not enough RR intervals: ${rrData?.intervals?.length || 0} < ${this.REQUIRED_RR_INTERVALS}`);
      // Return normal status but clear last arrhythmia data if signal is poor
      this.lastArrhythmiaData = null;
      return this.buildResult('normal');
    }

    const intervals = rrData.intervals;
    const avgRR = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const rmssd = calculateRMSSD(intervals);
    const rrVariation = calculateRRVariation(intervals);

    this.lastRMSSD = rmssd;
    this.lastRRVariation = rrVariation;
    this.debugLog.push(`Calculated Metrics: AvgRR=${avgRR.toFixed(0)}ms, RMSSD=${rmssd.toFixed(2)}ms, RRVar=${rrVariation.toFixed(3)}`);

    // Definir categoría de arritmia
    const category = this.categorizeArrhythmia(intervals, avgRR);
    this.debugLog.push(`Initial Category: ${category}`);

    // Update last arrhythmia data regardless of thresholds for logging/context
    this.lastArrhythmiaData = {
        timestamp: currentTime,
        rmssd: rmssd,
        rrVariation: rrVariation,
        // category: category // Consider adding category here if useful outside
    };

    // Check thresholds and timing constraints ONLY if category suggests arrhythmia
    if (category !== 'normal') {
         this.debugLog.push(`Potential arrhythmia detected (${category}). Checking thresholds & timing.`);
         if (rmssd > this.RMSSD_THRESHOLD || rrVariation > this.RR_VARIATION_THRESHOLD) {
             this.debugLog.push(`Thresholds exceeded: RMSSD=${rmssd.toFixed(2)} > ${this.RMSSD_THRESHOLD} OR RRVar=${rrVariation.toFixed(3)} > ${this.RR_VARIATION_THRESHOLD}`);
            if (currentTime - this.lastArrhythmiaTime > this.MIN_TIME_BETWEEN_ARRHYTHMIAS && this.arrhythmiaCounter < this.MAX_ARRHYTHMIAS_PER_SESSION) {
                this.arrhythmiaCounter++;
                this.lastArrhythmiaTime = currentTime;
                this.debugLog.push(`Arrhythmia confirmed & counted. Count: ${this.arrhythmiaCounter}, Last Time: ${currentTime}`);
                 return this.buildResult(category); // Return the specific category
            } else {
                 this.debugLog.push(`Arrhythmia detected but suppressed due to timing (${currentTime - this.lastArrhythmiaTime}ms < ${this.MIN_TIME_BETWEEN_ARRHYTHMIAS}ms) or max count (${this.arrhythmiaCounter}/${this.MAX_ARRHYTHMIAS_PER_SESSION}).`);
                 // Return 'possible-arrhythmia' to indicate detection but suppression
                 return this.buildResult('possible-arrhythmia');
            }
        } else {
            this.debugLog.push(`Category suggested arrhythmia, but thresholds NOT exceeded.`);
             // Thresholds not met, return normal but keep lastArrhythmiaData for context
            return this.buildResult('normal');
        }
    } else {
         this.debugLog.push(`Category is normal. No arrhythmia detected.`);
         // Normal category, clear specific last arrhythmia data if needed or just return normal
         // this.lastArrhythmiaData = null; // Optional: clear if only storing confirmed events
         return this.buildResult('normal');
    }
  }

  private categorizeArrhythmia(intervals: number[], avgRR: number): ArrhythmiaProcessingResult['arrhythmiaStatus'] {
        const heartRate = 60000 / avgRR;
        this.debugLog.push(`Derived HR: ${heartRate.toFixed(1)} BPM`);

        // Basic Tachycardia/Bradycardia checks
        // Consider age/condition specific thresholds from userProfile
        const highHRThreshold = this.userProfile.condition === 'athlete' ? 110 : 100;
        const lowHRThreshold = this.userProfile.condition === 'athlete' ? 40 : 50;
        if (heartRate > highHRThreshold) return 'tachycardia';
        if (heartRate < lowHRThreshold) return 'bradycardia';

        // Simple Bigeminy check (alternating long/short pattern) - requires more intervals ideally
        if (intervals.length >= 4) {
            let bigeminyPattern = true;
            const firstInterval = intervals[0];
            const secondInterval = intervals[1];
            // Check if subsequent pairs follow the alternating pattern approximately
            for (let i = 2; i < intervals.length - 1; i += 2) {
                 // Allow some tolerance (e.g., 15%)
                if (!(Math.abs(intervals[i] - firstInterval) / firstInterval < 0.15 &&
                      Math.abs(intervals[i+1] - secondInterval) / secondInterval < 0.15)) {
                    bigeminyPattern = false;
                    break;
                }
            }
            if (bigeminyPattern && Math.abs(firstInterval - secondInterval) / avgRR > 0.2) { // Ensure intervals are significantly different
                 this.debugLog.push(`Bigeminy pattern detected.`);
                return 'bigeminy';
            }
        }

        // If RMSSD or Variation is high but no specific pattern matches
        const rmssd = calculateRMSSD(intervals);
        const rrVariation = calculateRRVariation(intervals);
         if (rmssd > this.RMSSD_THRESHOLD || rrVariation > this.RR_VARIATION_THRESHOLD) {
             this.debugLog.push(`High variability detected (RMSSD or RRVar), categorized as possible-arrhythmia.`);
            return 'possible-arrhythmia';
        }

        return 'normal';
    }

  private buildResult(status: ArrhythmiaProcessingResult['arrhythmiaStatus']): ArrhythmiaProcessingResult {
        // Only include lastArrhythmiaData if the status is not 'normal' or if needed for context
        const includeData = status !== 'normal';
        return {
            arrhythmiaStatus: status,
            lastArrhythmiaData: includeData ? this.lastArrhythmiaData : null,
            // Deprecate 'count' in result, use getArrhythmiaCount() method instead
            // count: this.arrhythmiaCounter
        };
    }

  public reset(): void {
    console.log("ArrhythmiaDetector reset.");
    this.lastArrhythmiaTime = 0;
    this.arrhythmiaCounter = 0;
    this.isLearningPhase = true;
    this.measurementStartTime = Date.now();
    this.lastRMSSD = 0;
    this.lastRRVariation = 0;
    this.lastArrhythmiaData = null;
    this.debugLog = [];
    // Re-apply threshold adjustments in case profile changed? Or assume profile is set before reset.
    // this.adjustThresholds();
  }

  public getArrhythmiaCount(): number {
      return this.arrhythmiaCounter;
  }

  public getDebugLog(): string[] {
      return this.debugLog;
  }
}
