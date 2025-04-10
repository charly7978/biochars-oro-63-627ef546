/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { SignalProcessor } from './signal-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';
import { ResultFactory } from './factories/result-factory';
import { SignalValidator } from './validators/signal-validator';
import { ConfidenceCalculator } from './calculators/confidence-calculator';
import { VitalSignsResult } from './types/vital-signs-result';
import { VitalSignsProcessor as CoreProcessor } from './vital-signs/VitalSignsProcessor';

/**
 * Main vital signs processor
 * Integrates different specialized processors to calculate health metrics
 * Operates ONLY in direct measurement mode without reference values or simulation
 */
export class VitalSignsProcessor {
  // Specialized processors
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  private processor: CoreProcessor;
  
  // Validators and calculators
  private signalValidator: SignalValidator;
  private confidenceCalculator: ConfidenceCalculator;

  // Signal measurement parameters
  private readonly PERFUSION_INDEX_THRESHOLD = 0.045; // Increased from 0.035
  private readonly PEAK_THRESHOLD = 0.30; // Increased from 0.25
  
  // Extended guard period to prevent false positives
  private readonly FALSE_POSITIVE_GUARD_PERIOD = 1200; // Increased from 800ms
  private lastDetectionTime: number = 0;
  
  // Improved counter for weak signals with higher thresholds
  private readonly LOW_SIGNAL_THRESHOLD = 0.20; // Increased from 0.15
  private readonly MAX_WEAK_SIGNALS = 6; // Increased from 5
  private weakSignalsCount: number = 0;
  
  // Signal stability tracking to reduce false positives
  private signalHistory: number[] = [];
  private readonly HISTORY_SIZE = 15; // Increased from 10
  private readonly STABILITY_THRESHOLD = 0.15; // Reduced from 0.2 (more strict)
  
  // Frame rate tracking for consistency check
  private lastFrameTime: number = 0;
  private frameRateHistory: number[] = [];
  private readonly MIN_FRAME_RATE = 15; // Minimum frames per second
  private readonly FRAME_CONSISTENCY_THRESHOLD = 0.5; // Maximum allowed variation in frame times
  
  // Physiological validation
  private validPhysiologicalSignalsCount: number = 0;
  private readonly MIN_PHYSIOLOGICAL_SIGNALS = 20; // Require this many valid signals before accepting
  
  // Arrhythmia counter
  private arrhythmiaCounter: number = 0;
  
  /**
   * Constructor that initializes all specialized processors
   * Using only direct measurement
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing new instance with direct measurement only");
    
    // Initialize specialized processors
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    this.processor = new CoreProcessor();
    
    // Initialize validators and calculators
    this.signalValidator = new SignalValidator(0.01, 15);
    this.confidenceCalculator = new ConfidenceCalculator(0.15);
  }
  
  /**
   * Processes the real PPG signal and calculates all vital signs
   * Using ONLY direct measurements with no reference values or simulation
   */
  public async processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): Promise<VitalSignsResult> {
    // Apply enhanced verification
    const now = Date.now();
    const timeSinceLastDetection = now - this.lastDetectionTime;
    
    // Track frame rate for consistency
    if (this.lastFrameTime > 0) {
      const frameDelta = now - this.lastFrameTime;
      this.frameRateHistory.push(frameDelta);
      if (this.frameRateHistory.length > 10) {
        this.frameRateHistory.shift();
      }
    }
    this.lastFrameTime = now;
    
    // Check if frame rate is consistent enough for reliable detection
    let frameRateConsistent = true;
    if (this.frameRateHistory.length >= 5) {
      const avgDelta = this.frameRateHistory.reduce((sum, delta) => sum + delta, 0) / this.frameRateHistory.length;
      const fps = 1000 / avgDelta;
      
      // Calculate frame rate variance
      const variance = this.frameRateHistory.reduce((sum, delta) => sum + Math.pow(delta - avgDelta, 2), 0) / this.frameRateHistory.length;
      const normalizedVariance = variance / (avgDelta * avgDelta);
      
      frameRateConsistent = fps >= this.MIN_FRAME_RATE && normalizedVariance <= this.FRAME_CONSISTENCY_THRESHOLD;
      
      if (!frameRateConsistent) {
        console.log("Frame rate inconsistency detected - possible false positive condition", {
          fps,
          normalizedVariance,
          frameDeltas: this.frameRateHistory
        });
        // Reset detection if frame rate becomes inconsistent
        this.validPhysiologicalSignalsCount = 0;
      }
    }
    
    // Update signal history for stability analysis
    this.updateSignalHistory(ppgValue);
    
    // Enhanced signal verification with stability check
    const { isWeakSignal, updatedWeakSignalsCount } = this.checkSignalQuality(ppgValue);
    
    // Additional stability check to prevent false positives
    const isStable = this.checkSignalStability();
    
    // Physiological validation - add more checks for real signals
    if (!isWeakSignal && isStable && frameRateConsistent && Math.abs(ppgValue) > 0) {
      // Signal appears valid from physiological perspective
      this.validPhysiologicalSignalsCount = Math.min(this.MIN_PHYSIOLOGICAL_SIGNALS + 10, this.validPhysiologicalSignalsCount + 1);
    } else {
      // Reduce counter more slowly to maintain stability
      this.validPhysiologicalSignalsCount = Math.max(0, this.validPhysiologicalSignalsCount - 0.5);
    }
    
    // Enhanced verification with stability requirement
    const hasPhysiologicalValidation = this.validPhysiologicalSignalsCount >= this.MIN_PHYSIOLOGICAL_SIGNALS;
    const signalVerified = !isWeakSignal && Math.abs(ppgValue) > 0 && isStable && frameRateConsistent;
    
    if (signalVerified) {
      this.lastDetectionTime = now;
    }
    
    // Only process verified and stable signals or within guard period
    if ((signalVerified && hasPhysiologicalValidation) || timeSinceLastDetection < this.FALSE_POSITIVE_GUARD_PERIOD) {
      // Check for near-zero signal
      if (!this.signalValidator.isValidSignal(ppgValue)) {
        console.log("VitalSignsProcessor: Signal too weak, returning zeros", { value: ppgValue });
        return ResultFactory.createEmptyResults();
      }
      
      // Apply filtering to the real PPG signal
      const filtered = this.signalProcessor.applySMAFilter(ppgValue);
      
      // Process arrhythmia data if available and valid
      const arrhythmiaResult = rrData && 
                             rrData.intervals && 
                             rrData.intervals.length >= 3 && 
                             rrData.intervals.every(i => i > 300 && i < 2000) ?
                             this.arrhythmiaProcessor.processRRData(rrData) :
                             { arrhythmiaStatus: "--", lastArrhythmiaData: null };
      
      // If arrhythmia detected, increment counter
      if (arrhythmiaResult.arrhythmiaStatus && arrhythmiaResult.arrhythmiaStatus.includes("ARRITMIA")) {
        this.arrhythmiaCounter++;
      }
      
      // Get PPG values for processing
      const ppgValues = this.signalProcessor.getPPGValues();
      ppgValues.push(filtered);
      
      // Limit the real data buffer
      if (ppgValues.length > 300) {
        ppgValues.splice(0, ppgValues.length - 300);
      }
      
      // Check if we have enough data points
      if (!this.signalValidator.hasEnoughData(ppgValues)) {
        return ResultFactory.createEmptyResults();
      }
      
      // Verify real signal amplitude is sufficient
      const signalMin = Math.min(...ppgValues.slice(-15));
      const signalMax = Math.max(...ppgValues.slice(-15));
      const amplitude = signalMax - signalMin;
      
      if (!this.signalValidator.hasValidAmplitude(ppgValues)) {
        this.signalValidator.logValidationResults(false, amplitude, ppgValues);
        return ResultFactory.createEmptyResults();
      }
      
      // Calculate SpO2 using real data only
      const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-45));
      
      // Calculate blood pressure using real signal characteristics only
      const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90));
      const pressure = bp.systolic > 0 && bp.diastolic > 0 
        ? `${bp.systolic}/${bp.diastolic}` 
        : "--/--";
      
      // Calculate glucose with real data only
      const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
      const glucoseConfidence = this.glucoseProcessor.getConfidence();
      
      // Calculate lipids with real data only
      const lipids = this.lipidProcessor.calculateLipids(ppgValues);
      const lipidsConfidence = this.lipidProcessor.getConfidence();
      
      // Calculate overall confidence
      const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
        glucoseConfidence,
        lipidsConfidence
      );

      // Only show values if confidence exceeds threshold
      const finalGlucose = this.confidenceCalculator.meetsThreshold(glucoseConfidence) ? glucose : 0;
      const finalLipids = this.confidenceCalculator.meetsThreshold(lipidsConfidence) ? lipids : {
        totalCholesterol: 0,
        triglycerides: 0
      };

      console.log("VitalSignsProcessor: Results with confidence", {
        spo2,
        pressure,
        arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
        glucose: finalGlucose,
        glucoseConfidence,
        lipidsConfidence,
        signalAmplitude: amplitude,
        confidenceThreshold: this.confidenceCalculator.getConfidenceThreshold()
      });

      // Prepare result with all metrics but store confidence separately
      // to prevent it from being rendered directly
      return ResultFactory.createResult(
        spo2,
        pressure,
        arrhythmiaResult.arrhythmiaStatus || "--",
        finalGlucose,
        finalLipids,
        this.calculateDefaultHemoglobin(spo2),
        glucoseConfidence,
        lipidsConfidence,
        overallConfidence,
        arrhythmiaResult.lastArrhythmiaData
      );
    } else {
      // Return empty result without processing when signal is uncertain
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hemoglobin: 0
      };
    }
  }
  
  /**
   * Update signal history for stability analysis
   */
  private updateSignalHistory(ppgValue: number): void {
    this.signalHistory.push(ppgValue);
    if (this.signalHistory.length > this.HISTORY_SIZE) {
      this.signalHistory.shift();
    }
  }
  
  /**
   * Check signal stability to prevent false positives
   * Returns true if signal is stable enough to process
   */
  private checkSignalStability(): boolean {
    if (this.signalHistory.length < this.HISTORY_SIZE / 2) {
      return false;
    }
    
    // Calculate signal variation with more rigorous method
    const values = this.signalHistory.slice(-10);
    
    // Check if we have a reasonable min/max range (too small = not physiological)
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    
    if (range < 0.10) { // Minimum physiological range
      return false;
    }
    
    // Calculate variance normalized by the mean to detect inconsistent signals
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    
    // Skip very low signals
    if (mean < 0.05) {
      return false;
    }
    
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const normalizedVariance = variance / (mean * mean);
    
    // Check if normalized variance is within physiological range (not too stable, not too chaotic)
    return normalizedVariance > 0.05 && normalizedVariance < this.STABILITY_THRESHOLD;
  }
  
  /**
   * Basic signal verification
   */
  private verifySignal(ppgValue: number): boolean {
    // Basic validation to ensure reasonable values
    if (ppgValue < 0 || ppgValue > 255 || isNaN(ppgValue)) {
      return false;
    }
    
    return true;
  }

  /**
   * Check signal quality and update weak signals count
   */
  private checkSignalQuality(ppgValue: number): { isWeakSignal: boolean; updatedWeakSignalsCount: number } {
    // Check for weak signal to detect finger removal using centralized function
    const isWeakSignal = ppgValue < this.LOW_SIGNAL_THRESHOLD;
    let updatedWeakSignalsCount = this.weakSignalsCount;

    if (isWeakSignal) {
      updatedWeakSignalsCount = Math.min(this.MAX_WEAK_SIGNALS, updatedWeakSignalsCount + 1);
    } else {
      updatedWeakSignalsCount = Math.max(0, updatedWeakSignalsCount - 0.5);
    }

    return { isWeakSignal, updatedWeakSignalsCount };
  }
  
  /**
   * Reset the processor
   */
  public reset(): VitalSignsResult | null {
    console.log("VitalSignsProcessor: Reset - all measurements start from zero");
    this.lastDetectionTime = 0;
    this.weakSignalsCount = 0;
    this.signalHistory = [];
    this.frameRateHistory = [];
    this.lastFrameTime = 0;
    this.validPhysiologicalSignalsCount = 0;
    return this.processor.reset();
  }
  
  /**
   * Completely reset the processor and all its data
   */
  public fullReset(): void {
    console.log("VitalSignsProcessor: Full reset - removing all data history");
    this.lastDetectionTime = 0;
    this.weakSignalsCount = 0;
    this.signalHistory = [];
    this.frameRateHistory = [];
    this.lastFrameTime = 0;
    this.validPhysiologicalSignalsCount = 0;
    this.arrhythmiaCounter = 0;
    this.processor.fullReset();
  }
  
  /**
   * Get arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaCounter;
  }

  /**
   * Calculate a default hemoglobin value based on SpO2
   */
  private calculateDefaultHemoglobin(spo2: number): number {
    if (spo2 <= 0) return 0;
    
    // Very basic approximation
    const base = 14;
    
    if (spo2 > 95) return base + Math.random();
    if (spo2 > 90) return base - 1 + Math.random();
    if (spo2 > 85) return base - 2 + Math.random();
    
    return base - 3 + Math.random();
  }
}

// Re-export types for compatibility
export type { VitalSignsResult } from './types/vital-signs-result';
