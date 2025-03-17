
/**
 * Legacy VitalSignsProcessor converted to TypeScript
 * This file adapts the old JavaScript implementation into the new TypeScript structure
 * by leveraging the modular components and configurations
 */

import { ProcessorConfig } from '../vital-signs/ProcessorConfig';
import { VitalSignsResult } from '../vital-signs/VitalSignsProcessor';
import { SignalValidator } from '../signal-validation/SignalValidator';
import { LegacyArrhythmiaDetector } from './components/LegacyArrhythmiaDetector';
import { LegacySignalProcessor } from './components/LegacySignalProcessor';
import { LegacySpO2Calculator } from './components/LegacySpO2Calculator';
import { LegacyBloodPressureCalculator } from './components/LegacyBloodPressureCalculator';

export class LegacyVitalSignsProcessor {
  private signalProcessor: LegacySignalProcessor;
  private arrhythmiaDetector: LegacyArrhythmiaDetector;
  private spo2Calculator: LegacySpO2Calculator;
  private bpCalculator: LegacyBloodPressureCalculator;
  private signalValidator: SignalValidator;
  private measurementStartTime: number = Date.now();
  
  constructor() {
    this.signalProcessor = new LegacySignalProcessor();
    this.arrhythmiaDetector = new LegacyArrhythmiaDetector();
    this.spo2Calculator = new LegacySpO2Calculator();
    this.bpCalculator = new LegacyBloodPressureCalculator();
    this.signalValidator = new SignalValidator();
    this.measurementStartTime = Date.now();
  }

  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    console.log("VitalSignsProcessor: Signal input", {
      ppgValue,
      isLearning: this.arrhythmiaDetector.isLearningPhase(),
      rrIntervalsCount: this.arrhythmiaDetector.getRRIntervalsCount(),
      receivedRRData: rrData ? true : false
    });

    // Apply filtering to the signal
    const filteredValue = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Update PPG values buffer
    this.signalProcessor.updatePPGValues(filteredValue);

    // Process RR data if available
    if (rrData && rrData.intervals.length > 0) {
      this.arrhythmiaDetector.updateRRData(rrData);
      
      // Detect arrhythmias if we have enough data and not in learning phase
      if (!this.arrhythmiaDetector.isLearningPhase() && 
          this.arrhythmiaDetector.getRRIntervalsCount() >= ProcessorConfig.RR_WINDOW_SIZE) {
        this.arrhythmiaDetector.detectArrhythmia();
      }
    }

    // Calculate SpO2
    const spo2 = this.spo2Calculator.calculateSpO2(this.signalProcessor.getPPGValues().slice(-60));
    
    // Calculate blood pressure
    const bp = this.bpCalculator.calculateBloodPressure(this.signalProcessor.getPPGValues().slice(-60));
    const pressureString = `${bp.systolic}/${bp.diastolic}`;

    // Determine arrhythmia status
    const arrhythmiaStatus = this.arrhythmiaDetector.getArrhythmiaStatus(this.measurementStartTime);

    console.log("VitalSignsProcessor: Current state", {
      timestamp: Date.now(),
      isLearningPhase: this.arrhythmiaDetector.isLearningPhase(),
      arrhythmiaDetected: this.arrhythmiaDetector.isArrhythmiaDetected(),
      arrhythmiaStatus,
      rrIntervals: this.arrhythmiaDetector.getRRIntervalsCount()
    });

    // Use the SignalValidator to determine confidence values
    const signalQuality = this.signalValidator.validateSignalQuality(ppgValue).validSampleCounter / 10;
    
    // Create and return a standard VitalSignsResult
    return {
      spo2,
      pressure: pressureString,
      arrhythmiaStatus,
      glucose: 0, // Not calculated in legacy processor
      lipids: {
        totalCholesterol: 0, // Not calculated in legacy processor
        triglycerides: 0 // Not calculated in legacy processor
      }
    };
  }

  public reset(): void {
    // Reset all modules
    this.signalProcessor.reset();
    this.arrhythmiaDetector.reset();
    this.spo2Calculator.reset();
    this.bpCalculator.reset();
    this.signalValidator.reset();
    this.measurementStartTime = Date.now();
    console.log("VitalSignsProcessor: Complete reset");
  }
}
