import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { SignalProcessor } from './signal-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  confidence?: {
    glucose: number;
    lipids: number;
    overall: number;
  };
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  signalQuality?: number; // Added signal quality metric
}

/**
 * Main vital signs processor
 * Integrates different specialized processors to calculate health metrics
 * Operates in direct measurement mode without references or simulation
 */
export class VitalSignsProcessor {
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  
  // No storage of previous results
  
  // EXTREMELY strict thresholds for preventing false positives
  private readonly MIN_SIGNAL_AMPLITUDE = 0.15; // DRAMATICALLY increased from 0.05
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.70; // DRAMATICALLY increased from 0.40
  private readonly MIN_PPG_VALUES = 50; // DRAMATICALLY increased from 25
  
  // New validation thresholds
  private readonly MIN_SIGNAL_VARIANCE = 4.0; // New: Minimum required variance for real signals
  private readonly MAX_SIGNAL_VARIANCE = 25.0; // New: Maximum allowed variance (too high = noise)
  private readonly MIN_AMPLITUDE_INCREASE_FACTOR = 2.5; // New: Minimum factor for signal increase with finger
  private readonly MAX_CONSECUTIVE_SIMILAR_VALUES = 4; // New: Maximum allowed consecutive similar values
  private readonly MIN_PHYSIOLOGICAL_OSCILLATION = 0.8; // New: Minimum required oscillation for real signal
  
  // Tracking baseline for comparison
  private baselineValues: number[] = [];
  private readonly BASELINE_SIZE = 10;
  private hasEstablishedBaseline = false;

  /**
   * Constructor that initializes all specialized processors
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing new instance with direct measurement");
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
  }
  
  /**
   * Processes the PPG signal and calculates all vital signs
   * Using direct measurements with no reference values
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // MUCH stricter check for near-zero signal
    if (Math.abs(ppgValue) < 0.05) { // Increased from 0.02 to 0.05
      console.log("VitalSignsProcessor: Signal too weak, returning zeros", { value: ppgValue });
      return this.createEmptyResults();
    }
    
    // Establish baseline for comparison if not yet established
    if (!this.hasEstablishedBaseline) {
      this.baselineValues.push(ppgValue);
      if (this.baselineValues.length > this.BASELINE_SIZE) {
        this.baselineValues.shift();
        this.hasEstablishedBaseline = true;
        console.log("VitalSignsProcessor: Baseline established", { 
          baselineAvg: this.calculateMean(this.baselineValues),
          baselineVar: this.calculateVariance(this.baselineValues)
        });
      } else {
        console.log("VitalSignsProcessor: Collecting baseline", { 
          current: this.baselineValues.length, 
          needed: this.BASELINE_SIZE 
        });
        return this.createEmptyResults();
      }
    }
    
    // Apply filtering to the PPG signal
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // MUCH stricter validation for arrhythmia data
    const arrhythmiaResult = rrData && 
                           rrData.intervals.length >= 8 && // Increased from 5 to 8
                           rrData.intervals.every(i => i > 500 && i < 1500) ? // Even stricter range
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    
    // Get PPG values for processing
    const ppgValues = this.signalProcessor.getPPGValues();
    ppgValues.push(filtered);
    
    // Limit the PPG values buffer
    if (ppgValues.length > 300) {
      ppgValues.splice(0, ppgValues.length - 300);
    }
    
    // EXTREMELY strict requirement for minimum data points
    if (ppgValues.length < this.MIN_PPG_VALUES) {
      console.log("VitalSignsProcessor: Insufficient data points", {
        have: ppgValues.length,
        need: this.MIN_PPG_VALUES
      });
      return this.createEmptyResults();
    }
    
    // NEW: Compare with baseline to detect actual finger placement
    const baselineAvg = this.calculateMean(this.baselineValues);
    const signalAvg = this.calculateMean(ppgValues.slice(-20));
    const amplitudeIncreaseFactor = signalAvg / Math.max(0.1, baselineAvg);
    
    if (amplitudeIncreaseFactor < this.MIN_AMPLITUDE_INCREASE_FACTOR) {
      console.log("VitalSignsProcessor: Signal amplitude not significantly different from baseline", {
        baselineAvg,
        signalAvg,
        factor: amplitudeIncreaseFactor,
        minFactor: this.MIN_AMPLITUDE_INCREASE_FACTOR
      });
      return this.createEmptyResults();
    }
    
    // NEW: Check for suspiciously stable signal (potential false positive)
    const last20Values = ppgValues.slice(-20);
    const signalVariance = this.calculateVariance(last20Values);
    
    if (signalVariance < this.MIN_SIGNAL_VARIANCE) {
      console.log("VitalSignsProcessor: Signal variance too low (likely artificial)", {
        variance: signalVariance,
        minThreshold: this.MIN_SIGNAL_VARIANCE
      });
      return this.createEmptyResults();
    }
    
    if (signalVariance > this.MAX_SIGNAL_VARIANCE) {
      console.log("VitalSignsProcessor: Signal variance too high (likely noise)", {
        variance: signalVariance,
        maxThreshold: this.MAX_SIGNAL_VARIANCE
      });
      return this.createEmptyResults();
    }
    
    // NEW: Check for suspiciously similar consecutive values
    let tooManyConsecutiveSimilar = false;
    let similarCount = 1;
    const SIMILARITY_THRESHOLD = 0.01;
    
    for (let i = 1; i < last20Values.length; i++) {
      if (Math.abs(last20Values[i] - last20Values[i-1]) < SIMILARITY_THRESHOLD) {
        similarCount++;
        if (similarCount > this.MAX_CONSECUTIVE_SIMILAR_VALUES) {
          tooManyConsecutiveSimilar = true;
          break;
        }
      } else {
        similarCount = 1;
      }
    }
    
    if (tooManyConsecutiveSimilar) {
      console.log("VitalSignsProcessor: Too many consecutive similar values (likely artificial)", {
        similarCount,
        maxAllowed: this.MAX_CONSECUTIVE_SIMILAR_VALUES
      });
      return this.createEmptyResults();
    }
    
    // NEW: Check for physiological oscillation pattern
    const oscillationScore = this.calculateOscillationScore(last20Values);
    if (oscillationScore < this.MIN_PHYSIOLOGICAL_OSCILLATION) {
      console.log("VitalSignsProcessor: Signal lacks physiological oscillation pattern", {
        oscillationScore,
        minRequired: this.MIN_PHYSIOLOGICAL_OSCILLATION
      });
      return this.createEmptyResults();
    }
    
    // Verify signal amplitude is sufficient - MUCH stricter check
    const signalMin = Math.min(...ppgValues.slice(-15));
    const signalMax = Math.max(...ppgValues.slice(-15));
    const amplitude = signalMax - signalMin;
    
    if (amplitude < this.MIN_SIGNAL_AMPLITUDE) {
      console.log("VitalSignsProcessor: Signal amplitude too low", {
        amplitude,
        threshold: this.MIN_SIGNAL_AMPLITUDE
      });
      return this.createEmptyResults();
    }
    
    // Calculate SpO2 using direct approach
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-45));
    
    // Calculate blood pressure using only signal characteristics
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";
    
    // Calculate glucose with direct real-time data
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calculate lipids
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calculate overall confidence
    const overallConfidence = (glucoseConfidence * 0.5) + (lipidsConfidence * 0.5);

    // EXTREMELY stricter confidence threshold for showing values
    const finalGlucose = glucoseConfidence > this.MIN_CONFIDENCE_THRESHOLD ? glucose : 0;
    const finalLipids = lipidsConfidence > this.MIN_CONFIDENCE_THRESHOLD ? lipids : {
      totalCholesterol: 0,
      triglycerides: 0
    };

    // NEW: Calculate overall signal quality based on vital sign measurements
    let signalQuality = 0;
    
    // Only calculate quality if we have valid measurements
    if (spo2 > 0 || finalGlucose > 0 || finalLipids.totalCholesterol > 0) {
      // Calculate quality components for each vital sign
      const spo2Quality = spo2 > 0 ? Math.min(100, Math.max(0, (spo2 - 80) * 5)) : 0; // Scale 80-100 to 0-100
      const pressureQuality = bp.systolic > 0 ? 80 : 0; // Binary quality for blood pressure
      const glucoseQuality = finalGlucose > 0 ? Math.min(100, glucoseConfidence * 100) : 0;
      const lipidsQuality = finalLipids.totalCholesterol > 0 ? Math.min(100, lipidsConfidence * 100) : 0;
      
      // Combine qualities with appropriate weights
      const measurementCount = (spo2 > 0 ? 1 : 0) + 
                              (bp.systolic > 0 ? 1 : 0) + 
                              (finalGlucose > 0 ? 1 : 0) + 
                              (finalLipids.totalCholesterol > 0 ? 1 : 0);
      
      if (measurementCount > 0) {
        // Weight measurements by their importance and reliability
        signalQuality = Math.round(
          (spo2Quality * 0.3) + 
          (pressureQuality * 0.2) + 
          (glucoseQuality * 0.3) + 
          (lipidsQuality * 0.2)
        );
        
        // Apply oscillation and variance factors
        signalQuality = Math.round(signalQuality * oscillationScore);
        
        // Penalize for high variance
        const variancePenalty = Math.max(0.6, 1 - (signalVariance / 40));
        signalQuality = Math.round(signalQuality * variancePenalty);
        
        // Apply confidence threshold
        if (overallConfidence < this.MIN_CONFIDENCE_THRESHOLD) {
          signalQuality = Math.round(signalQuality * 0.5);
        }
      }
    }

    console.log("VitalSignsProcessor: Results with confidence", {
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      glucose: finalGlucose,
      glucoseConfidence,
      lipidsConfidence,
      signalAmplitude: amplitude,
      signalVariance,
      confidenceThreshold: this.MIN_CONFIDENCE_THRESHOLD,
      oscillationScore,
      calculatedSignalQuality: signalQuality
    });

    // Prepare result with all metrics - no caching or persistence
    return {
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
      glucose: finalGlucose,
      lipids: finalLipids,
      confidence: {
        glucose: glucoseConfidence,
        lipids: lipidsConfidence,
        overall: overallConfidence
      },
      signalQuality
    };
  }
  
  /**
   * Creates an empty result for when there is no valid data
   * Always returns zeros, not reference values
   */
  private createEmptyResults(): VitalSignsResult {
    return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      confidence: {
        glucose: 0,
        lipids: 0,
        overall: 0
      },
      signalQuality: 0
    };
  }
  
  /**
   * Helper method to calculate mean of signal values
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * Helper method to calculate variance of signal values
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = this.calculateMean(values);
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }
  
  /**
   * NEW: Calculate oscillation score to detect physiological patterns
   * Real PPG signals have a characteristic oscillatory pattern
   */
  private calculateOscillationScore(values: number[]): number {
    if (values.length < 10) return 0;
    
    let directionChanges = 0;
    let increasing = values[1] > values[0];
    
    // Count direction changes (peaks and valleys)
    for (let i = 2; i < values.length; i++) {
      const nowIncreasing = values[i] > values[i-1];
      if (nowIncreasing !== increasing) {
        directionChanges++;
        increasing = nowIncreasing;
      }
    }
    
    // Real physiological signals should have regular direction changes
    // Normalize to a 0-1 scale
    const expectedChanges = values.length / 4; // Approximately one peak and valley per 4 samples
    return Math.min(1, directionChanges / expectedChanges);
  }

  /**
   * Reset the processor
   * Ensures a clean state with no carried over values
   */
  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.baselineValues = [];
    this.hasEstablishedBaseline = false;
    console.log("VitalSignsProcessor: Reset complete - all processors at zero");
    return null; // Always return null to ensure measurements start from zero
  }
  
  /**
   * Get the last valid results - always returns null
   * Forces fresh measurements
   */
  public getLastValidResults(): VitalSignsResult | null {
    return null; // Always return null to ensure measurements start from zero
  }
  
  /**
   * Completely reset the processor, removing previous data and results
   */
  public fullReset(): void {
    this.reset();
    this.baselineValues = [];
    this.hasEstablishedBaseline = false;
    console.log("VitalSignsProcessor: Full reset completed - starting from zero");
  }
}

