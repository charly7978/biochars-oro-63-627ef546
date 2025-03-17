
import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from '../arrhythmia-processor';
import { SignalProcessor } from './signal-processor';
import { ProcessorConfig } from './ProcessorConfig';
import { SignalAnalyzer } from '../signal-analysis/SignalAnalyzer';

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
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
  private measurementStartTime: number = Date.now();

  constructor() {
    console.log("VitalSignsProcessor: Initializing new instance");
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
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
    
    if (ppgValues.length < ProcessorConfig.MIN_PPG_VALUES) {
      console.log("VitalSignsProcessor: Insufficient data points", {
        have: ppgValues.length,
        need: ProcessorConfig.MIN_PPG_VALUES
      });
      return this.createEmptyResults();
    }
    
    const signalMin = Math.min(...ppgValues.slice(-15));
    const signalMax = Math.max(...ppgValues.slice(-15));
    const amplitude = signalMax - signalMin;
    
    if (amplitude < ProcessorConfig.MIN_SIGNAL_AMPLITUDE) {
      console.log("VitalSignsProcessor: Signal amplitude too low", {
        amplitude,
        threshold: ProcessorConfig.MIN_SIGNAL_AMPLITUDE
      });
      return this.createEmptyResults();
    }
    
    const spo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-45));
    
    const bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90));
    const pressure = bp.systolic > 0 && bp.diastolic > 0 
      ? `${bp.systolic}/${bp.diastolic}` 
      : "--/--";

    console.log("VitalSignsProcessor: Results", {
      spo2,
      pressure,
      arrhythmiaStatus: formattedArrhythmiaResult.arrhythmiaStatus,
      signalAmplitude: amplitude
    });

    return {
      spo2,
      pressure,
      arrhythmiaStatus: formattedArrhythmiaResult.arrhythmiaStatus,
      lastArrhythmiaData: formattedArrhythmiaResult.lastArrhythmiaData
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
    this.measurementStartTime = Date.now();
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
