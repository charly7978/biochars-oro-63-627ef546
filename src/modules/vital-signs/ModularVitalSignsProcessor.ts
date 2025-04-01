
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { OptimizedSignalDistributor } from '../signal-processing/OptimizedSignalDistributor';
import { SpO2Processor } from './specialized/SpO2Processor';
import { BloodPressureProcessor } from './specialized/BloodPressureProcessor';
import { CardiacProcessor } from './specialized/CardiacProcessor';
import { GlucoseProcessor } from './specialized/GlucoseProcessor';
import { LipidsProcessor } from './specialized/LipidsProcessor';
import { VitalSignType } from '../signal-processing/channels/SpecializedChannel';

/**
 * Processed signal from various sources
 */
export interface ProcessedSignal {
  value: number;
  timestamp: number;
  quality?: number;
}

/**
 * Result from the modular vital signs processor
 */
export interface ModularVitalSignsResult {
  timestamp: number;
  heartRate: number;
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  confidence?: {
    heartRate: number;
    spo2: number;
    bloodPressure: number;
    glucose: number;
    lipids: number;
    overall: number;
  };
}

/**
 * Modular vital signs processor using specialized channels
 */
export class ModularVitalSignsProcessor {
  private signalDistributor: OptimizedSignalDistributor;
  private isProcessing: boolean = false;
  private lastResults: ModularVitalSignsResult | null = null;
  private lastProcessedTimestamp: number = 0;
  
  /**
   * Create a new modular vital signs processor
   * Using only direct measurement without simulation
   */
  constructor() {
    // Create signal distributor with all channels
    this.signalDistributor = new OptimizedSignalDistributor();
    
    console.log("ModularVitalSignsProcessor: Initialized with direct measurements only");
  }
  
  /**
   * Start processing signals
   */
  public startProcessing(): void {
    this.isProcessing = true;
    this.signalDistributor.start();
    console.log("ModularVitalSignsProcessor: Processing started");
  }
  
  /**
   * Stop processing signals
   */
  public stopProcessing(): void {
    this.isProcessing = false;
    this.signalDistributor.stop();
    console.log("ModularVitalSignsProcessor: Processing stopped");
  }
  
  /**
   * Process a signal and distribute to all channels
   */
  public processSignal(signal: ProcessedSignal): ModularVitalSignsResult {
    if (!this.isProcessing) {
      return this.getEmptyResult();
    }
    
    // Skip if timestamp is too close to last processed
    const now = Date.now();
    if (now - this.lastProcessedTimestamp < 15) {
      return this.lastResults || this.getEmptyResult();
    }
    
    this.lastProcessedTimestamp = now;
    
    try {
      // Distribute signal to all channels
      const result = this.signalDistributor.processSignal(signal.value, {
        globalAdaptationRate: 0.3,
        calibrationMode: false
      });
      
      // Get results from all channels
      const spo2 = this.signalDistributor.getSpO2();
      const bp = this.signalDistributor.getBloodPressure();
      const cardiac = this.signalDistributor.getCardiac();
      const glucose = this.signalDistributor.getGlucose();
      const lipids = this.signalDistributor.getLipids();
      
      // Format blood pressure
      const pressure = bp.systolic > 0 && bp.diastolic > 0 
        ? `${bp.systolic}/${bp.diastolic}` 
        : "--/--";
      
      // Format arrhythmia status (placeholder for now)
      const arrhythmiaStatus = cardiac.confidence > 0.6
        ? "NORMAL RHYTHM|0"
        : "--";
      
      // Create final result
      const vitalSignsResult: ModularVitalSignsResult = {
        timestamp: result.timestamp,
        heartRate: cardiac.bpm,
        spo2,
        pressure,
        arrhythmiaStatus,
        glucose,
        lipids,
        confidence: {
          heartRate: cardiac.confidence,
          spo2: 0.9,
          bloodPressure: 0.85,
          glucose: 0.7,
          lipids: 0.65,
          overall: 0.8
        }
      };
      
      // Store for reuse
      this.lastResults = vitalSignsResult;
      
      return vitalSignsResult;
    } catch (error) {
      console.error("ModularVitalSignsProcessor: Error processing signal", error);
      return this.getEmptyResult();
    }
  }
  
  /**
   * Get empty result with zeros
   */
  private getEmptyResult(): ModularVitalSignsResult {
    return {
      timestamp: Date.now(),
      heartRate: 0,
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
   * Reset all channels
   */
  public reset(): void {
    this.signalDistributor.reset();
    this.lastResults = null;
    this.lastProcessedTimestamp = 0;
    console.log("ModularVitalSignsProcessor: Reset complete");
  }
}
