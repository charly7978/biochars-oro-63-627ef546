
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
  
  // Debug tracking for glucose values
  private lastRawGlucose: number = 0;
  private lastMedianGlucose: number = 0;
  private glucoseValues: number[] = []; // Store recent glucose values for median calculation
  private readonly MAX_GLUCOSE_HISTORY = 10; // Keep last 10 values for final median
  
  // Wider thresholds for more inclusive physiological range
  private readonly MIN_SIGNAL_AMPLITUDE = 0.003; // Further reduced
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.05; // Further reduced

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
   * Calculates weighted median from a set of values
   * Ensures more stable readings by prioritizing recent values while still using median
   */
  private calculateWeightedMedian(values: number[]): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0];
    
    // Create weighted array with more recent values given higher weights
    const weightedArray: number[] = [];
    
    for (let i = 0; i < values.length; i++) {
      // More recent values (higher index) get higher weight
      const weight = Math.max(1, Math.floor((i + 1) * 1.5));
      
      for (let j = 0; j < weight; j++) {
        weightedArray.push(values[i]);
      }
    }
    
    // Sort and find median
    weightedArray.sort((a, b) => a - b);
    const middleIndex = Math.floor(weightedArray.length / 2);
    
    if (weightedArray.length % 2 === 0) {
      return (weightedArray[middleIndex - 1] + weightedArray[middleIndex]) / 2;
    }
    
    return weightedArray[middleIndex];
  }
  
  /**
   * Processes the PPG signal and calculates all vital signs
   * Using direct measurements with no reference values
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Apply filtering to the PPG signal
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Process arrhythmia data if available
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Get PPG values for processing
    const ppgValues = this.signalProcessor.getPPGValues();
    ppgValues.push(filtered);
    
    // Limit the PPG values buffer
    if (ppgValues.length > 300) {
      ppgValues.splice(0, ppgValues.length - 300);
    }
    
    // Only process with enough data
    if (ppgValues.length < 10) { // Further reduced for faster response
      return this.createEmptyResults();
    }
    
    // Calculate SpO2 using direct approach
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-45));
    
    // Calculate blood pressure using only signal characteristics
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";
    
    // Get the direct glucose value from processor (already using weighted median internally)
    const glucoseFromProcessor = this.glucoseProcessor.calculateGlucose(ppgValues);
    
    // Store this glucose value in our history
    this.glucoseValues.push(glucoseFromProcessor);
    if (this.glucoseValues.length > this.MAX_GLUCOSE_HISTORY) {
      this.glucoseValues.shift(); // Remove oldest value
    }
    
    // Calculate our own weighted median from recent glucose values
    // This ensures double stability - the processor uses median AND we use median of those values
    const finalGlucose = Math.round(this.calculateWeightedMedian(this.glucoseValues));
    
    // Track raw vs median values for debugging
    this.lastRawGlucose = glucoseFromProcessor;
    this.lastMedianGlucose = finalGlucose;
    
    // Very important debug log to confirm we're using the median
    console.log("VitalSignsProcessor: Final glucose calculation", {
      valueFromProcessor: glucoseFromProcessor,
      storedValues: [...this.glucoseValues], // Copy for logging
      finalWeightedMedian: finalGlucose,
      timestamp: new Date().toISOString(),
      numberOfSamplesUsed: this.glucoseValues.length,
      isDifferentFromLatestSample: finalGlucose !== glucoseFromProcessor
    });
    
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calculate lipids
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calculate overall confidence
    const overallConfidence = (glucoseConfidence * 0.5) + (lipidsConfidence * 0.5);

    // Prepare result with all metrics - using final weighted median glucose
    return {
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
      glucose: finalGlucose, // CRITICAL: Use the weighted median value, not the raw value
      lipids,
      confidence: {
        glucose: glucoseConfidence,
        lipids: lipidsConfidence,
        overall: overallConfidence
      }
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
      }
    };
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
    this.lastRawGlucose = 0;
    this.lastMedianGlucose = 0;
    this.glucoseValues = [];
    
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
    console.log("VitalSignsProcessor: Full reset completed - starting from zero");
  }
}
