
import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from '../arrhythmia-processor';
import { SignalProcessor } from './signal-processor';
import { ProcessorConfig } from './ProcessorConfig';
import { SignalAnalyzer } from '../signal-analysis/SignalAnalyzer';
import { GlucoseProcessor } from './glucose-processor';

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  glucose?: number;
  lipids?: {
    totalCholesterol?: number;
    triglycerides?: number;
    ldl?: number;
    hdl?: number;
  };
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

  constructor() {
    console.log("VitalSignsProcessor: Initializing new instance");
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
  }
  
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    if (Math.abs(ppgValue) < 0.005) {
      console.log("VitalSignsProcessor: Signal too weak, returning zeros");
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
    
    if (ppgValues.length < ProcessorConfig.MIN_PPG_VALUES) {
      console.log("VitalSignsProcessor: Insufficient data points");
      return this.createEmptyResults();
    }
    
    const signalMin = Math.min(...ppgValues.slice(-15));
    const signalMax = Math.max(...ppgValues.slice(-15));
    const amplitude = signalMax - signalMin;
    
    if (amplitude < ProcessorConfig.MIN_SIGNAL_AMPLITUDE) {
      console.log("VitalSignsProcessor: Signal amplitude too low");
      return this.createEmptyResults();
    }
    
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-45));
    
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";
      
    // Calculate glucose
    const glucose = this.glucoseProcessor.calculateGlucose(ppgValues.slice(-150));

    return {
      spo2,
      pressure,
      arrhythmiaStatus: formattedArrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: formattedArrhythmiaResult.lastArrhythmiaData,
      glucose
    };
  }
  
  private createEmptyResults(): VitalSignsResult {
    return {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      lastArrhythmiaData: null,
      glucose: 0
    };
  }

  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
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
