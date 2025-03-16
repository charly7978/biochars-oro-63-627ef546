
import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { LipidProcessor } from './lipid-processor';
import { GlucoseProcessor } from './glucose-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';

export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  lastArrhythmiaData?: {
    timestamp: number;
    type: string;
    confidence: number;
  };
}

/**
 * Processor for calculating vital signs from PPG signal
 */
export class VitalSignsProcessor {
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private lipidProcessor: LipidProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private lastValidResults: VitalSignsResult | null = null;
  private signalBuffer: number[] = [];
  private readonly SIGNAL_BUFFER_SIZE = 300;
  
  constructor() {
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.lipidProcessor = new LipidProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    console.log("VitalSignsProcessor: Initializing new instance with direct measurement");
  }
  
  /**
   * Process PPG signal to extract vital signs
   * Returns raw glucose values during measurement without applying median/average
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Add value to buffer
    this.signalBuffer.push(ppgValue);
    if (this.signalBuffer.length > this.SIGNAL_BUFFER_SIZE) {
      this.signalBuffer.shift();
    }
    
    // Process each vital sign
    const spo2 = this.spo2Processor.calculateSpO2(this.signalBuffer);
    const pressure = this.bpProcessor.calculateBloodPressure(this.signalBuffer);
    const arrhythmiaResult = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Get raw glucose value during measurement without final processing
    const glucose = this.glucoseProcessor.calculateGlucose(this.signalBuffer);
    
    const lipids = this.lipidProcessor.calculateLipids(this.signalBuffer);
    
    const result: VitalSignsResult = {
      spo2,
      pressure: `${pressure.systolic}/${pressure.diastolic}`,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      glucose,
      lipids,
      lastArrhythmiaData: arrhythmiaResult.lastArrhythmiaData
    };
    
    // Update last valid results if we have good values
    if (spo2 > 0 && glucose > 0) {
      this.lastValidResults = result;
    }
    
    return result;
  }
  
  /**
   * Reset the processor, but save the last valid results
   * Now explicitly calls finalizeMeasurement on the glucose processor
   * to apply weighted median and average ONLY at the end
   */
  public reset(): VitalSignsResult | null {
    // Save last valid results
    const savedResults = this.lastValidResults;
    
    // Apply final processing for glucose - THIS IS THE CRITICAL PART
    if (savedResults && this.glucoseProcessor) {
      console.log("VitalSignsProcessor: Finalizing glucose measurement with weighted median and average");
      
      // Get the final glucose value with weighted median and average
      const finalGlucoseValue = this.glucoseProcessor.finalizeMeasurement();
      console.log(`VitalSignsProcessor: Final glucose value: ${finalGlucoseValue}`);
      
      // Update the saved results with the final glucose value
      savedResults.glucose = finalGlucoseValue;
    }
    
    // Reset processors
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.lipidProcessor.reset();
    this.glucoseProcessor.reset();
    this.arrhythmiaProcessor.reset();
    
    // Clear signal buffer
    this.signalBuffer = [];
    
    return savedResults;
  }
  
  /**
   * Completely reset the processor and discard all data
   */
  public fullReset(): void {
    this.lastValidResults = null;
    this.signalBuffer = [];
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.lipidProcessor.reset();
    this.glucoseProcessor.reset();
    this.arrhythmiaProcessor.reset();
  }
}
