
/**
 * Main VitalSignsProcessor class that coordinates all the vital signs processing
 */
export class VitalSignsProcessor {
  // Processors for each vital sign
  private bloodPressureProcessor: any;
  private spo2Processor: any;
  private glucoseProcessor: any;
  private lipidsProcessor: any;
  private hydrationProcessor: any;
  private arrhythmiaProcessor: any;
  
  // Buffer for PPG signal
  private ppgBuffer: number[] = [];
  private readonly BUFFER_SIZE = 300;
  
  constructor() {
    // Initialize all processors
    this.bloodPressureProcessor = new BloodPressureProcessor();
    this.spo2Processor = new SpO2Processor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidsProcessor = new LipidsProcessor();
    this.hydrationProcessor = new HydrationProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    
    console.log("VitalSignsProcessor: Initialized with all components");
  }
  
  /**
   * Process a single PPG signal value
   */
  public processSignal(
    value: number, 
    rrData?: { intervals: number[], lastPeakTime: number | null }
  ): VitalSignsResult {
    // Add to buffer
    this.ppgBuffer.push(value);
    if (this.ppgBuffer.length > this.BUFFER_SIZE) {
      this.ppgBuffer.shift();
    }
    
    // Calculate each vital sign
    const bloodPressure = this.bloodPressureProcessor.calculateBloodPressure(this.ppgBuffer);
    const spO2 = this.spo2Processor.calculateSpO2(this.ppgBuffer);
    const glucose = this.glucoseProcessor.calculateGlucose(this.ppgBuffer);
    const lipids = this.lipidsProcessor.calculateLipids(this.ppgBuffer);
    const hydration = this.hydrationProcessor.calculateHydration(this.ppgBuffer);
    
    // Process arrhythmia using RR intervals
    const arrhythmia = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Return combined results
    return {
      bloodPressure,
      spO2,
      glucose,
      lipids,
      hydration,
      arrhythmia
    };
  }
  
  /**
   * Reset all processors
   */
  public reset(): void {
    this.bloodPressureProcessor.reset();
    this.spo2Processor.reset();
    this.glucoseProcessor.reset();
    this.lipidsProcessor.reset();
    this.hydrationProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.ppgBuffer = [];
    
    console.log("VitalSignsProcessor: All processors reset");
  }
  
  /**
   * Full reset of all components
   */
  public fullReset(): void {
    this.reset();
    console.log("VitalSignsProcessor: Full system reset completed");
  }
  
  /**
   * Get the current arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaProcessor.getArrhythmiaCount();
  }
}

// Import necessary processors
import { BloodPressureProcessor } from './blood-pressure-processor';
import { SpO2Processor } from './spo2-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidsProcessor } from './lipids-processor';
import { HydrationProcessor } from './hydration-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { VitalSignsResult } from '../../types/vital-signs';
