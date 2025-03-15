
/**
 * Advanced Arrhythmia Processor based on peer-reviewed cardiac research
 */

import { RRData, ArrhythmiaResult, NonLinearMetrics } from './types/arrhythmia-types';
import { calculateNonLinearMetrics, calculateRMSSD, calculateRRVariation } from './utils/hrv-metrics-calculator';
import { detectArrhythmia } from './utils/arrhythmia-decision-engine';

export class ArrhythmiaProcessor {
  // Configuration based on Harvard Medical School research on HRV
  private readonly RR_WINDOW_SIZE = 10; // Increased window for better statistical power
  private readonly RMSSD_THRESHOLD = 45; // More conservative threshold
  private readonly ARRHYTHMIA_LEARNING_PERIOD = 6000; // Extended learning period
  private readonly SD1_THRESHOLD = 35; // More conservative Poincaré plot SD1 threshold
  private readonly PERFUSION_INDEX_MIN = 0.3; // Higher minimum PI for reliable detection
  
  // Advanced detection parameters from Mayo Clinic research
  private readonly PNNX_THRESHOLD = 0.25; // More conservative pNN50 threshold
  private readonly SHANNON_ENTROPY_THRESHOLD = 1.8; // Higher entropy threshold
  private readonly SAMPLE_ENTROPY_THRESHOLD = 1.4; // Higher sample entropy threshold
  
  // Minimum time between arrhythmias to reduce false positives
  private readonly MIN_ARRHYTHMIA_INTERVAL = 2000; // 2 seconds minimum between detections

  // State variables
  private rrIntervals: number[] = [];
  private rrDifferences: number[] = [];
  private lastPeakTime: number | null = null;
  private isLearningPhase = true;
  private hasDetectedFirstArrhythmia = false;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastRMSSD: number = 0;
  private lastRRVariation: number = 0;
  private lastArrhythmiaTime: number = 0;
  private measurementStartTime: number = Date.now();
  
  // Advanced metrics
  private nonLinearMetrics: NonLinearMetrics = {
    shannonEntropy: 0,
    sampleEntropy: 0,
    pnnX: 0
  };

  /**
   * Processes heart beat data to detect arrhythmias using advanced HRV analysis
   * Based on techniques from "New frontiers in heart rate variability analysis"
   */
  public processRRData(rrData?: RRData): ArrhythmiaResult {
    const currentTime = Date.now();

    // Update RR intervals if available
    if (rrData?.intervals && rrData.intervals.length > 0) {
      this.rrIntervals = rrData.intervals;
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Compute RR differences for variability analysis
      if (this.rrIntervals.length >= 2) {
        this.rrDifferences = [];
        for (let i = 1; i < this.rrIntervals.length; i++) {
          this.rrDifferences.push(this.rrIntervals[i] - this.rrIntervals[i-1]);
        }
      }
      
      if (!this.isLearningPhase && this.rrIntervals.length >= this.RR_WINDOW_SIZE) {
        this.detectArrhythmia();
      }
    }

    // Check if learning phase is complete
    const timeSinceStart = currentTime - this.measurementStartTime;
    if (timeSinceStart > this.ARRHYTHMIA_LEARNING_PERIOD) {
      this.isLearningPhase = false;
    }

    // Determine arrhythmia status message
    let arrhythmiaStatus;
    if (this.isLearningPhase) {
      arrhythmiaStatus = "CALIBRANDO...";
    } else if (this.hasDetectedFirstArrhythmia) {
      arrhythmiaStatus = `ARRITMIA DETECTADA|${this.arrhythmiaCount}`;
    } else {
      arrhythmiaStatus = `SIN ARRITMIAS|${this.arrhythmiaCount}`;
    }

    // Prepare arrhythmia data if detected
    const lastArrhythmiaData = this.arrhythmiaDetected ? {
      timestamp: currentTime,
      rmssd: this.lastRMSSD,
      rrVariation: this.lastRRVariation
    } : null;

    return {
      arrhythmiaStatus,
      lastArrhythmiaData
    };
  }

  /**
   * Detects arrhythmia using multiple advanced HRV metrics
   * Based on ESC Guidelines for arrhythmia detection
   */
  private detectArrhythmia(): void {
    if (this.rrIntervals.length < this.RR_WINDOW_SIZE) return;

    const currentTime = Date.now();
    const recentRR = this.rrIntervals.slice(-this.RR_WINDOW_SIZE);
    
    // Calculate RMSSD with more stringent validation
    const { rmssd, validIntervals } = calculateRMSSD(recentRR);
    
    // Require at least 70% valid intervals
    if (validIntervals < this.RR_WINDOW_SIZE * 0.7) {
      return;
    }
    
    // Calculate mean RR and standard deviation with outlier rejection
    const validRRs = recentRR.filter(rr => rr >= 500 && rr <= 1500);
    if (validRRs.length < this.RR_WINDOW_SIZE * 0.7) return;
    
    // Calculate RR variation metrics
    const { 
      avgRR, 
      lastRR, 
      rrStandardDeviation, 
      coefficientOfVariation, 
      rrVariation 
    } = calculateRRVariation(validRRs);
    
    // Calculate advanced non-linear dynamics metrics
    this.nonLinearMetrics = calculateNonLinearMetrics(validRRs);
    
    this.lastRMSSD = rmssd;
    this.lastRRVariation = rrVariation;
    
    // Determine if arrhythmia is present using the decision engine
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const newArrhythmiaState = detectArrhythmia({
      rmssd,
      rrVariation,
      coefficientOfVariation,
      timeSinceLastArrhythmia,
      minArrhythmiaInterval: this.MIN_ARRHYTHMIA_INTERVAL,
      nonLinearMetrics: this.nonLinearMetrics
    });

    // If it's a new arrhythmia and enough time has passed since the last one
    if (newArrhythmiaState && 
        currentTime - this.lastArrhythmiaTime > 1000) { // Minimum 1 second between arrhythmias
      this.arrhythmiaCount++;
      this.lastArrhythmiaTime = currentTime;
      
      // Mark that we've detected the first arrhythmia
      this.hasDetectedFirstArrhythmia = true;
      
      console.log('VitalSignsProcessor - Nueva arritmia detectada:', {
        contador: this.arrhythmiaCount,
        rmssd,
        rrVariation,
        shannonEntropy: this.nonLinearMetrics.shannonEntropy,
        pnnX: this.nonLinearMetrics.pnnX,
        coefficientOfVariation,
        timestamp: currentTime
      });
    }

    this.arrhythmiaDetected = newArrhythmiaState;
  }

  /**
   * Reset the arrhythmia processor state
   */
  public reset(): void {
    this.rrIntervals = [];
    this.rrDifferences = [];
    this.lastPeakTime = null;
    this.isLearningPhase = true;
    this.hasDetectedFirstArrhythmia = false;
    this.arrhythmiaDetected = false;
    this.arrhythmiaCount = 0;
    this.measurementStartTime = Date.now();
    this.lastRMSSD = 0;
    this.lastRRVariation = 0;
    this.lastArrhythmiaTime = 0;
    this.nonLinearMetrics = {
      shannonEntropy: 0,
      sampleEntropy: 0,
      pnnX: 0
    };
  }
}
