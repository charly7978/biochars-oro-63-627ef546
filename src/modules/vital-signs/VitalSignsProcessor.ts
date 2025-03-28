
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
 */
export class VitalSignsProcessor {
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  
  private lastValidResults: VitalSignsResult | null = null;
  
  // Thresholds for valid measurements adjusted for real PPG measurements
  private readonly MIN_SIGNAL_AMPLITUDE = 0.02;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.25;

  /**
   * Constructor that initializes all specialized processors
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing new instance");
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
  }
  
  /**
   * Processes the PPG signal and calculates all vital signs
   * Implementing improved validation and stability strategies
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
    
    // Check minimum signal quality
    if (ppgValue < this.MIN_SIGNAL_AMPLITUDE && ppgValues.length < 60) {
      return this.getLastValidResults() || this.createEmptyResults();
    }
    
    // Only process with enough data
    if (ppgValues.length < 30) {
      return this.getLastValidResults() || this.createEmptyResults();
    }
    
    // Calculate SpO2
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-60));
    
    // Calculate blood pressure
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-120));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";
    
    // Calculate glucose
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    // Calculate lipids
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Calculate overall confidence
    const overallConfidence = (glucoseConfidence * 0.5) + (lipidsConfidence * 0.5);

    // Prepare result with all metrics
    const result: VitalSignsResult = {
      spo2,
      pressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData,
      glucose,
      lipids,
      confidence: {
        glucose: glucoseConfidence,
        lipids: lipidsConfidence,
        overall: overallConfidence
      }
    };
    
    // Update valid results if there is enough confidence
    if (this.isValidMeasurement(result)) {
      this.lastValidResults = { ...result };
    }

    return result;
  }
  
  /**
   * Checks if a measurement has enough quality to be considered valid
   */
  private isValidMeasurement(result: VitalSignsResult): boolean {
    const { spo2, pressure, glucose, lipids, confidence } = result;
    const [systolic, diastolic] = pressure.split('/').map(v => parseInt(v));
    
    return (
      confidence?.overall && confidence.overall >= this.MIN_CONFIDENCE_THRESHOLD &&
      spo2 > 0 && 
      !isNaN(systolic) && systolic > 0 && 
      !isNaN(diastolic) && diastolic > 0 && 
      glucose > 0 && 
      lipids.totalCholesterol > 0
    );
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
      }
    };
  }

  /**
   * Reset the processor while maintaining the last valid results
   */
  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    
    return this.lastValidResults;
  }
  
  /**
   * Get the last valid results
   */
  public getLastValidResults(): VitalSignsResult | null {
    return this.lastValidResults;
  }
  
  /**
   * Completely reset the processor, removing previous data and results
   */
  public fullReset(): void {
    this.reset();
    this.lastValidResults = null;
  }
}
