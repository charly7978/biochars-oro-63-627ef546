
import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from '../arrhythmia-processor';
import { SignalProcessor } from './signal-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';
import { SignalAnalyzer } from '../signal-analysis/SignalAnalyzer';
import { ProcessorConfig } from './ProcessorConfig';

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
  
  private readonly MIN_SIGNAL_AMPLITUDE = 0.01;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.15;
  private readonly MIN_PPG_VALUES = 15;

  constructor() {
    console.log("VitalSignsProcessor: Initializing new instance with direct measurement");
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
  }
  
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    if (Math.abs(ppgValue) < 0.005) {
      console.log("VitalSignsProcessor: Signal too weak, returning zeros", { value: ppgValue });
      return this.createEmptyResults();
    }
    
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Process arrhythmia data with the ArrhythmiaProcessor
    const arrhythmiaResult = rrData && 
                           rrData.intervals.length >= 3 && 
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { isArrhythmia: false, arrhythmiaCounter: 0, lastArrhythmiaData: null };
                           
    // Convert arrhythmia result to standard format
    const formattedArrhythmiaResult = SignalAnalyzer.formatArrhythmiaResult(arrhythmiaResult);
    
    const ppgValues = this.signalProcessor.getPPGValues();
    ppgValues.push(filtered);
    
    if (ppgValues.length > ProcessorConfig.WINDOW_SIZE) {
      ppgValues.splice(0, ppgValues.length - ProcessorConfig.WINDOW_SIZE);
    }
    
    if (ppgValues.length < this.MIN_PPG_VALUES) {
      console.log("VitalSignsProcessor: Insufficient data points", {
        have: ppgValues.length,
        need: this.MIN_PPG_VALUES
      });
      return this.createEmptyResults();
    }
    
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
    
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-45));
    
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";
    
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    
    const lipids = this.lipidProcessor.calculateLipids(ppgValues);
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    const overallConfidence = (glucoseConfidence * 0.5) + (lipidsConfidence * 0.5);

    const finalGlucose = glucoseConfidence > this.MIN_CONFIDENCE_THRESHOLD ? glucose : 0;
    const finalLipids = lipidsConfidence > this.MIN_CONFIDENCE_THRESHOLD ? lipids : {
      totalCholesterol: 0,
      triglycerides: 0
    };

    console.log("VitalSignsProcessor: Results with confidence", {
      spo2,
      pressure,
      arrhythmiaStatus: formattedArrhythmiaResult.arrhythmiaStatus,
      glucose: finalGlucose,
      glucoseConfidence,
      lipidsConfidence,
      signalAmplitude: amplitude,
      confidenceThreshold: this.MIN_CONFIDENCE_THRESHOLD
    });

    return {
      spo2,
      pressure,
      arrhythmiaStatus: formattedArrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: formattedArrhythmiaResult.lastArrhythmiaData,
      glucose: finalGlucose,
      lipids: finalLipids,
      confidence: {
        glucose: glucoseConfidence,
        lipids: lipidsConfidence,
        overall: overallConfidence
      }
    };
  }
  
  private createEmptyResults(): VitalSignsResult {
    return SignalAnalyzer.createEmptyResult();
  }

  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    console.log("VitalSignsProcessor: Reset complete - all processors at zero");
    return null;
  }
  
  public getLastValidResults(): VitalSignsResult | null {
    return null;
  }
  
  public fullReset(): void {
    this.reset();
    console.log("VitalSignsProcessor: Full reset completed - starting from zero");
  }
}
