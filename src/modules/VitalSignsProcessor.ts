import { BloodPressureProcessor } from "./blood-pressure/BloodPressureProcessor";
import { SpO2Processor } from "./spo2/SpO2Processor";

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
}

export class VitalSignsProcessor {
  private isRunning: boolean = false;
  private lastValidResults: VitalSignsResult | null = null;
  private totalSamples: number = 0;
  private MINIMUM_SAMPLES_REQUIRED: number = 100;
  
  private spo2Processor: SpO2Processor;
  private bloodPressureProcessor: BloodPressureProcessor;
  
  constructor() {
    this.spo2Processor = new SpO2Processor();
    this.bloodPressureProcessor = new BloodPressureProcessor();
  }
  
  public start(): void {
    this.isRunning = true;
    this.reset();
  }
  
  public stop(): void {
    this.isRunning = false;
  }
  
  private processSpo2(value: number): number {
    return this.spo2Processor.process(value);
  }
  
  private processBloodPressure(value: number): { systolic: number, diastolic: number } | null {
    return this.bloodPressureProcessor.process(value);
  }

  public processSignal(value: number): VitalSignsResult | null {
    if (!this.isRunning) return null;
    
    this.totalSamples++;
    
    // Process SpO2
    const spo2Value = this.processSpo2(value);
    
    // Process blood pressure
    let systolic = 0;
    let diastolic = 0;
    const pressureResult = this.processBloodPressure(value);
    if (pressureResult) {
      systolic = pressureResult.systolic;
      diastolic = pressureResult.diastolic;
    }
    
    // Only return if we have enough samples
    if (this.totalSamples < this.MINIMUM_SAMPLES_REQUIRED) {
      return null;
    }
    
    // Format the result
    this.lastValidResults = {
      spo2: Math.round(spo2Value),
      pressure: `${Math.round(systolic)}/${Math.round(diastolic)}`
    };
    
    return this.lastValidResults;
  }
  
  public getLastValidResults(): VitalSignsResult | null {
    return this.lastValidResults;
  }
  
  private spo2RawValues: number[] = [];
  private spo2Values: number[] = [];
  private spo2Calibration: number = 1.0;
  
  private bpRawValues: number[] = [];
  private systolicValues: number[] = [];
  private diastolicValues: number[] = [];
  private bloodPressureCalibration: number = 1.0;

  public reset(): VitalSignsResult | null {
    const savedResults = this.lastValidResults;
    
    // Reset SpO2 processor
    this.spo2RawValues = [];
    this.spo2Values = [];
    this.spo2Calibration = 1.0;
    
    // Reset blood pressure processor
    this.bpRawValues = [];
    this.systolicValues = [];
    this.diastolicValues = [];
    this.bloodPressureCalibration = 1.0;
    
    this.totalSamples = 0;
    
    this.lastValidResults = {
      spo2: 0,
      pressure: "--/--"
    };
    
    return savedResults;
  }
  
  public fullReset(): void {
    this.reset();
    this.spo2Processor.reset();
    this.bloodPressureProcessor.reset();
  }
}
