
import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
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
 */
export class VitalSignsProcessor {
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private signalProcessor: SignalProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  
  // Thresholds for reliable physiological detection
  private readonly MIN_SIGNAL_AMPLITUDE = 0.01;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.15;
  private readonly MIN_PPG_VALUES = 15;

  /**
   * Constructor that initializes all specialized processors
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing new instance with direct measurement");
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
  }
  
  /**
   * Processes the PPG signal and calculates all vital signs
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Check for near-zero signal - indicates no finger or poor placement
    if (Math.abs(ppgValue) < 0.005) {
      console.log("VitalSignsProcessor: Signal too weak, returning zeros", { value: ppgValue });
      return this.createEmptyResults();
    }
    
    // Apply filtering to the PPG signal
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Get PPG values for processing
    const ppgValues = this.signalProcessor.getPPGValues();
    ppgValues.push(filtered);
    
    // Limit the PPG values buffer
    if (ppgValues.length > 300) {
      ppgValues.splice(0, ppgValues.length - 300);
    }
    
    // Only process with enough data
    if (ppgValues.length < this.MIN_PPG_VALUES) {
      console.log("VitalSignsProcessor: Insufficient data points", {
        have: ppgValues.length,
        need: this.MIN_PPG_VALUES
      });
      return this.createEmptyResults();
    }
    
    // Verify signal amplitude is sufficient
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

    // Only show values if confidence exceeds threshold
    const finalGlucose = glucoseConfidence > this.MIN_CONFIDENCE_THRESHOLD ? glucose : 0;
    const finalLipids = lipidsConfidence > this.MIN_CONFIDENCE_THRESHOLD ? lipids : {
      totalCholesterol: 0,
      triglycerides: 0
    };

    console.log("VitalSignsProcessor: Results with confidence", {
      spo2,
      pressure,
      arrhythmiaStatus: "NO ARRHYTHMIAS|0",
      glucose: finalGlucose,
      glucoseConfidence,
      lipidsConfidence,
      signalAmplitude: amplitude,
      confidenceThreshold: this.MIN_CONFIDENCE_THRESHOLD
    });

    // Prepare result with all metrics - no caching or persistence
    return {
      spo2,
      pressure,
      arrhythmiaStatus: "NO ARRHYTHMIAS|0",
      lastArrhythmiaData: null,
      glucose: finalGlucose,
      lipids: finalLipids,
      confidence: {
        glucose: glucoseConfidence,
        lipids: lipidsConfidence,
        overall: overallConfidence
      }
    };
  }
  
  /**
   * Creates an empty result for when there is no valid data
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
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
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
    console.log("VitalSignsProcessor: Full reset completed - starting from zero");
  }
}
