
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Hybrid Vital Signs Processor
 * Combines traditional algorithms with neural network models for enhanced accuracy
 */

import { SpO2Processor } from './spo2-processor';
import { BloodPressureProcessor } from './blood-pressure-processor';
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { SignalProcessor } from './signal-processor';
import { GlucoseProcessor } from './glucose-processor';
import { LipidProcessor } from './lipid-processor';
import { ResultFactory } from './factories/result-factory';
import { SignalValidator } from './validators/signal-validator';
import { ConfidenceCalculator } from './calculators/confidence-calculator';
import { VitalSignsResult } from './types/vital-signs-result';
import { neuralPipeline, NeuralProcessingOptions } from '../ai/neural-pipeline';

/**
 * Configuration options for hybrid processing
 */
export interface HybridProcessingOptions {
  // Whether to use neural models
  useNeuralModels: boolean;
  
  // Weight given to neural model results (0-1)
  // 0 = only traditional, 1 = only neural
  neuralWeight: number;
  
  // Neural processing options
  neuralOptions?: Partial<NeuralProcessingOptions>;
  
  // Confidence threshold for using neural results
  neuralConfidenceThreshold: number;
}

/**
 * Hybrid Vital Signs Processor
 * Combines traditional algorithms with neural network models
 * Always falls back to traditional methods if neural processing fails
 */
export class HybridVitalSignsProcessor {
  // Traditional processors
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  
  // Validators and calculators
  private signalValidator: SignalValidator;
  private confidenceCalculator: ConfidenceCalculator;
  
  // Default options
  private defaultOptions: HybridProcessingOptions = {
    useNeuralModels: true,
    neuralWeight: 0.6,
    neuralConfidenceThreshold: 0.5,
    neuralOptions: {
      useDenoising: true,
      useTemporalModels: true
    }
  };
  
  // Hybrid processing options
  private options: HybridProcessingOptions;

  /**
   * Constructor that initializes all specialized processors
   * Using only direct measurement and neural models
   */
  constructor(options?: Partial<HybridProcessingOptions>) {
    console.log("HybridVitalSignsProcessor: Initializing new instance with hybrid processing");
    
    // Initialize options
    this.options = { ...this.defaultOptions, ...options };
    
    // Initialize specialized processors
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    
    // Initialize validators and calculators
    this.signalValidator = new SignalValidator(0.01, 15);
    this.confidenceCalculator = new ConfidenceCalculator(0.15);
    
    console.log("HybridVitalSignsProcessor: Configuration", {
      useNeuralModels: this.options.useNeuralModels,
      neuralWeight: this.options.neuralWeight,
      neuralConfidenceThreshold: this.options.neuralConfidenceThreshold
    });
  }
  
  /**
   * Process data from an object parameter
   * Added for backward compatibility
   */
  public processSignal(data: {
    value: number, 
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  }): VitalSignsResult {
    return this.process(data.value, data.rrData);
  }
  
  /**
   * Processes the real PPG signal and calculates all vital signs
   * Using direct measurements and neural models with no simulation
   */
  public async process(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): Promise<VitalSignsResult> {
    // Check for near-zero signal
    if (!this.signalValidator.isValidSignal(ppgValue)) {
      console.log("HybridVitalSignsProcessor: Signal too weak, returning zeros", { value: ppgValue });
      return ResultFactory.createEmptyResults();
    }
    
    // Apply filtering to the real PPG signal
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Process arrhythmia data if available and valid
    const arrhythmiaResult = rrData && 
                           rrData.intervals.length >= 3 && 
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    
    // Get PPG values for processing
    const ppgValues = this.signalProcessor.getPPGValues();
    ppgValues.push(filtered);
    
    // Limit the real data buffer
    if (ppgValues.length > 300) {
      ppgValues.splice(0, ppgValues.length - 300);
    }
    
    // Check if we have enough data points
    if (!this.signalValidator.hasEnoughData(ppgValues)) {
      return ResultFactory.createEmptyResults();
    }
    
    // Verify real signal amplitude is sufficient
    const signalMin = Math.min(...ppgValues.slice(-15));
    const signalMax = Math.max(...ppgValues.slice(-15));
    const amplitude = signalMax - signalMin;
    
    if (!this.signalValidator.hasValidAmplitude(ppgValues)) {
      this.signalValidator.logValidationResults(false, amplitude, ppgValues);
      return ResultFactory.createEmptyResults();
    }
    
    // Process with traditional methods first (always reliable fallback)
    const traditionalSpo2 = this.spo2Processor.calculateSpO2(ppgValues.slice(-45));
    const traditionalBp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90));
    const traditionalPressure = traditionalBp.systolic > 0 && traditionalBp.diastolic > 0 
      ? `${traditionalBp.systolic}/${traditionalBp.diastolic}` 
      : "--/--";
    const traditionalGlucose = this.glucoseProcessor.calculateGlucose(ppgValues);
    const traditionalLipids = this.lipidProcessor.calculateLipids(ppgValues);
    
    // Confidence values from traditional methods
    const glucoseConfidence = this.glucoseProcessor.getConfidence();
    const lipidsConfidence = this.lipidProcessor.getConfidence();
    
    // Process with neural methods if enabled
    let neuralResult = null;
    if (this.options.useNeuralModels && ppgValues.length >= 45) {
      try {
        // Get neural predictions
        neuralResult = await neuralPipeline.process(ppgValues, this.options.neuralOptions);
        
        console.log("HybridVitalSignsProcessor: Neural results", {
          spo2: neuralResult?.spo2,
          bloodPressure: neuralResult?.bloodPressure,
          glucose: neuralResult?.glucose,
          lipids: neuralResult?.lipids,
          confidence: neuralResult?.confidence,
          processingTime: neuralResult?.processingTime
        });
      } catch (error) {
        console.error("HybridVitalSignsProcessor: Neural processing error", error);
        // Continue with traditional results
      }
    }
    
    // Combine traditional and neural results based on configuration
    let finalSpo2 = traditionalSpo2;
    let finalPressure = traditionalPressure;
    let finalGlucose = traditionalGlucose;
    let finalLipids = traditionalLipids;
    
    // Calculate final confidence values
    let finalGlucoseConfidence = glucoseConfidence;
    let finalLipidsConfidence = lipidsConfidence;
    
    // Update values with neural results if available and confidence is high enough
    if (neuralResult && this.options.neuralWeight > 0) {
      // SPO2 fusion
      if (neuralResult.spo2 && neuralResult.confidence.spo2 && 
          neuralResult.confidence.spo2 >= this.options.neuralConfidenceThreshold) {
        finalSpo2 = Math.round(
          traditionalSpo2 * (1 - this.options.neuralWeight) + 
          neuralResult.spo2 * this.options.neuralWeight
        );
      }
      
      // Blood pressure fusion
      if (neuralResult.bloodPressure && neuralResult.confidence.bloodPressure && 
          neuralResult.confidence.bloodPressure >= this.options.neuralConfidenceThreshold) {
        const bp = neuralResult.bloodPressure;
        
        const fusedSystolic = Math.round(
          traditionalBp.systolic * (1 - this.options.neuralWeight) + 
          bp.systolic * this.options.neuralWeight
        );
        
        const fusedDiastolic = Math.round(
          traditionalBp.diastolic * (1 - this.options.neuralWeight) + 
          bp.diastolic * this.options.neuralWeight
        );
        
        finalPressure = `${fusedSystolic}/${fusedDiastolic}`;
      }
      
      // Glucose fusion
      if (neuralResult.glucose && neuralResult.confidence.glucose && 
          neuralResult.confidence.glucose >= this.options.neuralConfidenceThreshold) {
        finalGlucose = Math.round(
          traditionalGlucose * (1 - this.options.neuralWeight) + 
          neuralResult.glucose * this.options.neuralWeight
        );
        
        // Update confidence
        finalGlucoseConfidence = Math.max(
          glucoseConfidence,
          neuralResult.confidence.glucose
        );
      }
      
      // Lipids fusion
      if (neuralResult.lipids && neuralResult.confidence.lipids && 
          neuralResult.confidence.lipids >= this.options.neuralConfidenceThreshold) {
        
        finalLipids.totalCholesterol = Math.round(
          traditionalLipids.totalCholesterol * (1 - this.options.neuralWeight) + 
          neuralResult.lipids.totalCholesterol * this.options.neuralWeight
        );
        
        finalLipids.triglycerides = Math.round(
          traditionalLipids.triglycerides * (1 - this.options.neuralWeight) + 
          neuralResult.lipids.triglycerides * this.options.neuralWeight
        );
        
        // Update confidence
        finalLipidsConfidence = Math.max(
          lipidsConfidence,
          neuralResult.confidence.lipids
        );
      }
    }
    
    // Calculate overall confidence
    const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
      finalGlucoseConfidence,
      finalLipidsConfidence
    );
    
    // Only show values if confidence exceeds threshold
    const validatedGlucose = this.confidenceCalculator.meetsThreshold(finalGlucoseConfidence) ? finalGlucose : 0;
    const validatedLipids = this.confidenceCalculator.meetsThreshold(finalLipidsConfidence) ? finalLipids : {
      totalCholesterol: 0,
      triglycerides: 0
    };
    
    console.log("HybridVitalSignsProcessor: Final results with confidence", {
      spo2: finalSpo2,
      pressure: finalPressure,
      arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
      glucose: validatedGlucose,
      glucoseConfidence: finalGlucoseConfidence,
      lipidsConfidence: finalLipidsConfidence,
      signalAmplitude: amplitude,
      confidenceThreshold: this.confidenceCalculator.getConfidenceThreshold(),
      neuralModelUsed: neuralResult !== null
    });
    
    // Prepare result with all metrics
    return ResultFactory.createResult(
      finalSpo2,
      finalPressure,
      arrhythmiaResult.arrhythmiaStatus,
      validatedGlucose,
      validatedLipids,
      {
        glucose: finalGlucoseConfidence,
        lipids: finalLipidsConfidence,
        overall: overallConfidence
      },
      arrhythmiaResult.lastArrhythmiaData
    );
  }
  
  /**
   * Reset the processor to ensure a clean state
   * No reference values or simulations
   */
  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    console.log("HybridVitalSignsProcessor: Reset complete - all processors at zero");
    return null; // Always return null to ensure measurements start from zero
  }
  
  /**
   * Get arrhythmia counter
   */
  public getArrhythmiaCounter(): number {
    return this.arrhythmiaProcessor.getArrhythmiaCount();
  }
  
  /**
   * Get the last valid results - always returns null
   * Forces fresh measurements without reference values
   */
  public getLastValidResults(): VitalSignsResult | null {
    return null; // Always return null to ensure measurements start from zero
  }
  
  /**
   * Completely reset the processor
   * Ensures fresh start with no data carryover
   */
  public fullReset(): void {
    this.reset();
    console.log("HybridVitalSignsProcessor: Full reset completed - starting from zero");
  }
  
  /**
   * Update hybrid processing options
   */
  public updateOptions(options: Partial<HybridProcessingOptions>): void {
    this.options = { ...this.options, ...options };
    console.log("HybridVitalSignsProcessor: Updated options", this.options);
  }
  
  /**
   * Enable or disable neural processing
   */
  public setNeuralProcessing(enabled: boolean): void {
    this.options.useNeuralModels = enabled;
    console.log(`HybridVitalSignsProcessor: Neural processing ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Get neural processing status
   */
  public isNeuralProcessingEnabled(): boolean {
    return this.options.useNeuralModels;
  }
  
  /**
   * Get hybrid processing options
   */
  public getOptions(): HybridProcessingOptions {
    return { ...this.options };
  }
}
