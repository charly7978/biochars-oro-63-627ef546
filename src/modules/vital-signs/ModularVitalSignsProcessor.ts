
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Modular Vital Signs Processor
 * Uses the OptimizedSignalDistributor to provide dedicated signal channels
 * for each vital sign algorithm
 */

import { ProcessedSignal, VitalSignType, ChannelFeedback } from '../../types/signal';
import { OptimizedSignalDistributor } from '../signal-processing/OptimizedSignalDistributor';
import { v4 as uuidv4 } from 'uuid';

// Import specialized vital sign processors
import { GlucoseProcessor } from './specialized/GlucoseProcessor';
import { LipidsProcessor } from './specialized/LipidsProcessor';
import { BloodPressureProcessor } from './specialized/BloodPressureProcessor';
import { SpO2Processor } from './specialized/SpO2Processor';
import { CardiacProcessor } from './specialized/CardiacProcessor';

/**
 * Result interface for vital sign measurements
 */
export interface VitalSignsResult {
  // Standard measurements
  spo2: number;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  cardiac: {
    heartRate: number;
    arrhythmiaDetected: boolean;
    rhythmRegularity: number;
  };
  
  // Quality and metadata
  measurementId: string;
  timestamp: number;
  signalQuality: number;
  confidence: {
    spo2: number;
    glucose: number;
    lipids: number;
    bloodPressure: number;
    cardiac: number;
  };
}

/**
 * Modular vital signs processor
 * Coordinates specialized processors and the optimized signal distributor
 */
export class ModularVitalSignsProcessor {
  // Signal distributor for optimized channels
  private signalDistributor: OptimizedSignalDistributor;
  
  // Specialized processors for each vital sign
  private glucoseProcessor: GlucoseProcessor;
  private lipidsProcessor: LipidsProcessor;
  private bloodPressureProcessor: BloodPressureProcessor;
  private spo2Processor: SpO2Processor;
  private cardiacProcessor: CardiacProcessor;
  
  // Processing state
  private isProcessing: boolean = false;
  private lastProcessedSignal: ProcessedSignal | null = null;
  private lastResult: VitalSignsResult | null = null;
  
  /**
   * Constructor
   */
  constructor() {
    console.log("ModularVitalSignsProcessor: Initializing with specialized processors and optimized signal channels");
    
    // Create signal distributor
    this.signalDistributor = new OptimizedSignalDistributor({
      enableFeedback: true,
      adaptChannels: true,
      optimizationInterval: 3000 // 3 seconds
    });
    
    // Create specialized processors
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidsProcessor = new LipidsProcessor();
    this.bloodPressureProcessor = new BloodPressureProcessor();
    this.spo2Processor = new SpO2Processor();
    this.cardiacProcessor = new CardiacProcessor();
  }
  
  /**
   * Start processing
   */
  public start(): void {
    if (this.isProcessing) return;
    
    // Start signal distributor
    this.signalDistributor.start();
    
    // Initialize all processors
    this.glucoseProcessor.initialize();
    this.lipidsProcessor.initialize();
    this.bloodPressureProcessor.initialize();
    this.spo2Processor.initialize();
    this.cardiacProcessor.initialize();
    
    this.isProcessing = true;
    console.log("ModularVitalSignsProcessor: Started processing");
  }
  
  /**
   * Stop processing
   */
  public stop(): void {
    if (!this.isProcessing) return;
    
    // Stop signal distributor
    this.signalDistributor.stop();
    
    this.isProcessing = false;
    console.log("ModularVitalSignsProcessor: Stopped processing");
  }
  
  /**
   * Reset processor state
   */
  public reset(): void {
    // Reset signal distributor
    this.signalDistributor.reset();
    
    // Reset all processors
    this.glucoseProcessor.reset();
    this.lipidsProcessor.reset();
    this.bloodPressureProcessor.reset();
    this.spo2Processor.reset();
    this.cardiacProcessor.reset();
    
    this.lastProcessedSignal = null;
    this.lastResult = null;
    
    console.log("ModularVitalSignsProcessor: Reset complete");
  }
  
  /**
   * Process a signal and calculate all vital signs
   * @param signal Processed PPG signal
   * @returns Vital signs result
   */
  public processSignal(signal: ProcessedSignal): VitalSignsResult {
    if (!this.isProcessing) {
      console.log("ModularVitalSignsProcessor: Not processing, returning empty result");
      return this.createEmptyResult();
    }
    
    // Store for later reference
    this.lastProcessedSignal = signal;
    
    // Skip processing if finger is not detected or quality is too low
    if (!signal.fingerDetected || signal.quality < 20) {
      console.log("ModularVitalSignsProcessor: Skipping - no finger or low quality", {
        fingerDetected: signal.fingerDetected,
        quality: signal.quality
      });
      return this.createEmptyResult();
    }
    
    try {
      // Start performance measurement
      const startTime = performance.now();
      
      // Distribute signal to specialized channels
      const channelValues = this.signalDistributor.processSignal(signal);
      
      // Process each vital sign with its optimized signal
      const glucoseValue = this.glucoseProcessor.processValue(channelValues[VitalSignType.GLUCOSE]);
      const lipidsValues = this.lipidsProcessor.processValue(channelValues[VitalSignType.LIPIDS]);
      const bloodPressureValues = this.bloodPressureProcessor.processValue(channelValues[VitalSignType.BLOOD_PRESSURE]);
      const spo2Value = this.spo2Processor.processValue(channelValues[VitalSignType.SPO2]);
      const cardiacValues = this.cardiacProcessor.processValue(channelValues[VitalSignType.CARDIAC]);
      
      // Get confidence levels
      const confidenceLevels = {
        glucose: this.glucoseProcessor.getConfidence(),
        lipids: this.lipidsProcessor.getConfidence(),
        bloodPressure: this.bloodPressureProcessor.getConfidence(),
        spo2: this.spo2Processor.getConfidence(),
        cardiac: this.cardiacProcessor.getConfidence()
      };
      
      // Apply feedback from each processor to its channel
      this.applyProcessorFeedback();
      
      // Create result object
      const result: VitalSignsResult = {
        measurementId: uuidv4(),
        timestamp: Date.now(),
        signalQuality: signal.quality,
        
        // Vital sign values
        glucose: glucoseValue,
        lipids: lipidsValues,
        bloodPressure: bloodPressureValues,
        spo2: spo2Value,
        cardiac: cardiacValues,
        
        // Confidence levels
        confidence: confidenceLevels
      };
      
      // Store result
      this.lastResult = result;
      
      // Performance logging
      const processingTime = performance.now() - startTime;
      if (processingTime > 10) { // Only log if significant
        console.log("ModularVitalSignsProcessor: Signal processed", {
          processingTime,
          signalQuality: signal.quality,
          glucose: glucoseValue,
          systolic: bloodPressureValues.systolic,
          diastolic: bloodPressureValues.diastolic,
          spo2: spo2Value,
          heartRate: cardiacValues.heartRate
        });
      }
      
      return result;
    } catch (error) {
      console.error("ModularVitalSignsProcessor: Error processing signal", error);
      return this.createEmptyResult();
    }
  }
  
  /**
   * Apply feedback from each processor to its channel
   * Enables bidirectional optimization
   */
  private applyProcessorFeedback(): void {
    // Get feedback from glucose processor and apply to channel
    const glucoseFeedback = this.glucoseProcessor.getFeedback();
    if (glucoseFeedback) {
      this.signalDistributor.applyFeedback(glucoseFeedback);
    }
    
    // Get feedback from lipids processor and apply to channel
    const lipidsFeedback = this.lipidsProcessor.getFeedback();
    if (lipidsFeedback) {
      this.signalDistributor.applyFeedback(lipidsFeedback);
    }
    
    // Get feedback from blood pressure processor and apply to channel
    const bpFeedback = this.bloodPressureProcessor.getFeedback();
    if (bpFeedback) {
      this.signalDistributor.applyFeedback(bpFeedback);
    }
    
    // Get feedback from SpO2 processor and apply to channel
    const spo2Feedback = this.spo2Processor.getFeedback();
    if (spo2Feedback) {
      this.signalDistributor.applyFeedback(spo2Feedback);
    }
    
    // Get feedback from cardiac processor and apply to channel
    const cardiacFeedback = this.cardiacProcessor.getFeedback();
    if (cardiacFeedback) {
      this.signalDistributor.applyFeedback(cardiacFeedback);
    }
  }
  
  /**
   * Create an empty result for invalid signals or non-processing state
   */
  private createEmptyResult(): VitalSignsResult {
    return {
      measurementId: uuidv4(),
      timestamp: Date.now(),
      signalQuality: 0,
      
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      bloodPressure: {
        systolic: 0,
        diastolic: 0
      },
      spo2: 0,
      cardiac: {
        heartRate: 0,
        arrhythmiaDetected: false,
        rhythmRegularity: 0
      },
      
      confidence: {
        glucose: 0,
        lipids: 0,
        bloodPressure: 0,
        spo2: 0,
        cardiac: 0
      }
    };
  }
  
  /**
   * Get the last processed result
   */
  public getLastResult(): VitalSignsResult | null {
    return this.lastResult;
  }
  
  /**
   * Get diagnostics information about the processor and signal distributor
   */
  public getDiagnostics(): any {
    return {
      isProcessing: this.isProcessing,
      lastSignalTimestamp: this.lastProcessedSignal?.timestamp,
      lastSignalQuality: this.lastProcessedSignal?.quality,
      distributorDiagnostics: this.signalDistributor.getDiagnostics(),
      processorConfidence: this.lastResult?.confidence
    };
  }
}
