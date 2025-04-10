
import { VitalSignsConfig } from '../config/VitalSignsConfig';
import { RRIntervalData } from '../types';

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

export interface ArrhythmiaProcessingResult {
  arrhythmiaStatus: string;
  lastArrhythmiaData: { 
    timestamp: number; 
    rmssd: number; 
    rrVariation: number; 
  } | null;
}

interface UserProfile {
  age: number;
  condition?: 'athlete' | 'hypertension' | 'diabetes';
}

/**
 * Unified ArrhythmiaDetector combining the best features from all implementations:
 * - User profile-based calibration from core/analysis/ArrhythmiaDetector
 * - Pattern detection from vital-signs/arrhythmia-processor
 * - Zero-crossing technique from heart-beat/ArrhythmiaDetector
 */
export class ArrhythmiaDetectorUnified {
  // Configuration values from centralized config
  private readonly RMSSD_THRESHOLD: number;
  private readonly RR_VARIATION_THRESHOLD: number;
  private readonly MIN_TIME_BETWEEN_ARRHYTHMIAS: number;
  private readonly MAX_ARRHYTHMIAS_PER_SESSION = 10;
  private readonly REQUIRED_RR_INTERVALS: number;
  private readonly LEARNING_PERIOD = 4000; // ms

  // State tracking
  private lastArrhythmiaTime: number = 0;
  private arrhythmiaCounter: number = 0;
  private isLearningPhase: boolean = true;
  private measurementStartTime: number = Date.now();
  private lastRMSSD: number = 0;
  private lastRRVariation: number = 0;
  private lastArrhythmiaData: ArrhythmiaResult['lastArrhythmiaData'] = null;
  private debugLog: string[] = [];
  
  // Pattern detection
  private patternBuffer: number[] = [];
  private consecutiveAbnormalBeats = 0;
  private readonly CONSECUTIVE_THRESHOLD: number;

  constructor(private userProfile: UserProfile = { age: VitalSignsConfig.userProfile.AGE }) {
    // Initialize from config
    this.RMSSD_THRESHOLD = VitalSignsConfig.arrhythmia.THRESHOLDS.RMSSD;
    this.RR_VARIATION_THRESHOLD = VitalSignsConfig.arrhythmia.THRESHOLDS.RR_VARIATION;
    this.MIN_TIME_BETWEEN_ARRHYTHMIAS = VitalSignsConfig.arrhythmia.TIMING.MIN_TIME_BETWEEN_ARRHYTHMIAS;
    this.REQUIRED_RR_INTERVALS = VitalSignsConfig.arrhythmia.DATA.REQUIRED_RR_INTERVALS;
    this.CONSECUTIVE_THRESHOLD = VitalSignsConfig.arrhythmia.DATA.CONSECUTIVE_THRESHOLD;
    
    this.adjustThresholds();
    this.reset();
  }

  private adjustThresholds(): void {
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

  /**
   * Process RR interval data to detect arrhythmias
   * @param rrData Object containing RR intervals and last peak time
   * @returns Processing result with arrhythmia status
   */
  public processRRData(rrData?: RRIntervalData): ArrhythmiaProcessingResult {
    const currentTime = Date.now();
    if (this.isLearningPhase && currentTime - this.measurementStartTime > this.LEARNING_PERIOD) {
      this.isLearningPhase = false;
    }

    if (!rrData || !rrData.intervals || rrData.intervals.length < this.REQUIRED_RR_INTERVALS) {
      return this.buildProcessingResult('normal');
    }

    const rmssd = this.calculateRMSSD(rrData.intervals);
    const rrVariation = this.calculateRRVariation(rrData.intervals);
    
    this.lastRMSSD = rmssd;
    this.lastRRVariation = rrVariation;
    
    // Update pattern buffer
    this.updatePatternBuffer(rrVariation);

    // Detect arrhythmia based on computed metrics
    const arrhythmiaResult = this.detectArrhythmia(rrData.intervals, rmssd, rrVariation, currentTime);
    
    // Build the result
    return this.buildProcessingResult(arrhythmiaResult.arrhythmiaStatus);
  }

  /**
   * Core arrhythmia detection logic
   */
  private detectArrhythmia(
    intervals: number[], 
    rmssd: number, 
    rrVariation: number, 
    currentTime: number
  ): ArrhythmiaResult {
    let hasArrhythmia = false;
    let category: ArrhythmiaResult['arrhythmiaStatus'] = 'normal';

    if (!this.isLearningPhase &&
        rmssd > this.RMSSD_THRESHOLD &&
        rrVariation > this.RR_VARIATION_THRESHOLD) {

      const timeSinceLast = currentTime - this.lastArrhythmiaTime;
      if (timeSinceLast > this.MIN_TIME_BETWEEN_ARRHYTHMIAS &&
          this.arrhythmiaCounter < this.MAX_ARRHYTHMIAS_PER_SESSION) {

        // Update consecutive abnormal beats counter
        this.consecutiveAbnormalBeats++;
        
        // Only confirm arrhythmia after enough consecutive abnormal beats
        if (this.consecutiveAbnormalBeats >= this.CONSECUTIVE_THRESHOLD) {
          hasArrhythmia = true;
          const avgRR = this.calculateAverageRR(intervals);
          category = this.categorizeArrhythmia(intervals, avgRR);
          this.lastArrhythmiaTime = currentTime;
          this.arrhythmiaCounter++;
          this.consecutiveAbnormalBeats = 0;

          this.lastArrhythmiaData = {
            timestamp: currentTime,
            rmssd,
            rrVariation,
            category
          };
          this.debugLog.push(`Arrhythmia detected at ${currentTime} - ${category}`);
        }
      }
    } else {
      // Reset consecutive counter if normal beat
      this.consecutiveAbnormalBeats = Math.max(0, this.consecutiveAbnormalBeats - 1);
    }

    return this.buildResult(category);
  }

  /**
   * Update pattern buffer for detection
   */
  private updatePatternBuffer(rrVariation: number): void {
    this.patternBuffer.push(rrVariation);
    if (this.patternBuffer.length > VitalSignsConfig.arrhythmia.PATTERN.PATTERN_BUFFER_SIZE) {
      this.patternBuffer.shift();
    }
  }

  /**
   * Categorize the type of arrhythmia based on intervals
   */
  private categorizeArrhythmia(intervals: number[], avgRR: number): ArrhythmiaResult['arrhythmiaStatus'] {
    const last = intervals[intervals.length - 1];
    if (last < 500) return 'tachycardia';
    if (last > 1200) return 'bradycardia';

    const variation = Math.abs(intervals[intervals.length - 1] - intervals[intervals.length - 2]);
    if (variation > avgRR * 0.2) return 'bigeminy';

    return 'possible-arrhythmia';
  }

  /**
   * Calculate average RR interval
   */
  private calculateAverageRR(intervals: number[]): number {
    return intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  }

  /**
   * Build arrhythmia result object
   */
  private buildResult(category: ArrhythmiaResult['arrhythmiaStatus']): ArrhythmiaResult {
    return {
      arrhythmiaStatus: category,
      lastArrhythmiaData: this.lastArrhythmiaData,
      count: this.arrhythmiaCounter,
      debugLog: [...this.debugLog]
    };
  }

  /**
   * Build processing result for arrhythmia processor
   */
  private buildProcessingResult(status: ArrhythmiaResult['arrhythmiaStatus']): ArrhythmiaProcessingResult {
    const statusMessage = status === 'normal' ? 
      `NO ARRHYTHMIAS|${this.arrhythmiaCounter}` :
      `ARRHYTHMIA DETECTED|${this.arrhythmiaCounter}`;

    return {
      arrhythmiaStatus: statusMessage,
      lastArrhythmiaData: this.lastArrhythmiaData
    };
  }

  /**
   * Calculate RMSSD (Root Mean Square of Successive Differences)
   */
  private calculateRMSSD(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    const diffs = intervals.slice(1).map((val, i) => val - intervals[i]);
    const squared = diffs.map(d => d * d);
    const mean = squared.reduce((sum, val) => sum + val, 0) / squared.length;
    return Math.sqrt(mean);
  }

  /**
   * Calculate RR variation
   */
  private calculateRRVariation(intervals: number[]): number {
    if (intervals.length < 2) return 0;
    
    const mean = this.calculateAverageRR(intervals);
    const lastRR = intervals[intervals.length - 1];
    
    return Math.abs(lastRR - mean) / mean;
  }

  /**
   * Reset the detector
   */
  public reset(): void {
    this.lastArrhythmiaTime = 0;
    this.arrhythmiaCounter = 0;
    this.isLearningPhase = true;
    this.measurementStartTime = Date.now();
    this.lastRMSSD = 0;
    this.lastRRVariation = 0;
    this.lastArrhythmiaData = null;
    this.debugLog = [];
    this.patternBuffer = [];
    this.consecutiveAbnormalBeats = 0;
  }

  /**
   * Get current arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCounter;
  }

  /**
   * Get debug log
   */
  public getDebugLog(): string[] {
    return [...this.debugLog];
  }
}
