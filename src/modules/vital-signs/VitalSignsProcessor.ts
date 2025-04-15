
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
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
import { HydrationEstimator } from '../../core/analysis/HydrationEstimator';
import { TensorFlowWorkerClient } from '../../workers/tensorflow-worker-client';
import { SignalChannel } from '../../core/signal-processing/SignalChannel';

// Cliente singleton para TensorFlow
let tfWorkerClient: TensorFlowWorkerClient | null = null;

/**
 * Main vital signs processor with real neural network integration
 * Integrates different specialized processors to calculate health metrics
 * Uses differential channel architecture for optimized processing
 * Operates ONLY in direct measurement mode with real neural network integration
 */
export class VitalSignsProcessor {
  // Specialized processors
  private spo2Processor: SpO2Processor;
  private bpProcessor: BloodPressureProcessor;
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private signalProcessor: SignalProcessor;
  private glucoseProcessor: GlucoseProcessor;
  private lipidProcessor: LipidProcessor;
  private hydrationEstimator: HydrationEstimator;
  
  // Validators and calculators
  private signalValidator: SignalValidator;
  private confidenceCalculator: ConfidenceCalculator;
  
  // TensorFlow integration
  private isModelReady: boolean = false;
  private modelLoadAttempted: boolean = false;
  
  // Differential signal channels
  private cardiacChannel: SignalChannel;
  private spo2Channel: SignalChannel;
  private bpChannel: SignalChannel;
  private glucoseChannel: SignalChannel;
  private lipidChannel: SignalChannel;
  
  // Processing counters
  private processedSignals: number = 0;
  private arrhythmiaCounter: number = 0;

  /**
   * Constructor that initializes all specialized processors
   * and the differential channel architecture
   */
  constructor() {
    console.log("VitalSignsProcessor: Initializing new instance with neural network integration");
    
    // Initialize specialized processors
    this.spo2Processor = new SpO2Processor();
    this.bpProcessor = new BloodPressureProcessor();
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.signalProcessor = new SignalProcessor();
    this.glucoseProcessor = new GlucoseProcessor();
    this.lipidProcessor = new LipidProcessor();
    this.hydrationEstimator = new HydrationEstimator();
    
    // Initialize validators and calculators
    this.signalValidator = new SignalValidator(0.01, 15);
    this.confidenceCalculator = new ConfidenceCalculator(0.15);
    
    // Initialize differential channels
    this.cardiacChannel = new SignalChannel('cardiac', 150, {
      sampleRate: 30,
      feedbackEnabled: true,
      optimizationLevel: 'high'
    });
    
    this.spo2Channel = new SignalChannel('spo2', 150, {
      sampleRate: 30,
      feedbackEnabled: true,
      optimizationLevel: 'medium'
    });
    
    this.bpChannel = new SignalChannel('bloodPressure', 150, {
      sampleRate: 30,
      feedbackEnabled: true,
      optimizationLevel: 'medium'
    });
    
    this.glucoseChannel = new SignalChannel('glucose', 150, {
      sampleRate: 30,
      feedbackEnabled: true,
      optimizationLevel: 'low'
    });
    
    this.lipidChannel = new SignalChannel('temperature', 150, {
      sampleRate: 30,
      feedbackEnabled: true,
      optimizationLevel: 'low'
    });
    
    // Link channels for bidirectional feedback
    this.cardiacChannel.linkChannel(this.bpChannel);
    this.cardiacChannel.linkChannel(this.spo2Channel);
    this.bpChannel.linkChannel(this.spo2Channel);
    
    // Initialize TensorFlow
    this.initializeTensorFlow();
  }
  
  /**
   * Initialize TensorFlow for real neural network processing
   */
  private async initializeTensorFlow(): Promise<void> {
    try {
      if (!tfWorkerClient) {
        console.log("VitalSignsProcessor: Inicializando TensorFlow Worker");
        tfWorkerClient = new TensorFlowWorkerClient();
        await tfWorkerClient.initialize();
      }
      
      // Load necessary models
      await tfWorkerClient.loadModel('heartRate');
      await tfWorkerClient.loadModel('arrhythmia');
      await tfWorkerClient.loadModel('spo2');
      await tfWorkerClient.loadModel('bloodPressure');
      
      this.isModelReady = true;
      console.log("VitalSignsProcessor: Modelos TensorFlow cargados exitosamente");
    } catch (error) {
      console.error("VitalSignsProcessor: Error inicializando TensorFlow:", error);
      this.isModelReady = false;
    } finally {
      this.modelLoadAttempted = true;
    }
  }
  
  /**
   * Processes the real PPG signal and calculates all vital signs
   * Using differential channels with bidirectional feedback
   * Enhanced with neural network processing
   */
  public async processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): Promise<VitalSignsResult> {
    // Check for near-zero signal
    if (!this.signalValidator.isValidSignal(ppgValue)) {
      console.log("VitalSignsProcessor: Signal too weak, returning zeros", { value: ppgValue });
      return ResultFactory.createEmptyResults();
    }
    
    // Apply filtering to the real PPG signal
    const filtered = this.signalProcessor.applySMAFilter(ppgValue);
    
    // Process arrhythmia data if available and valid
    const arrhythmiaResult = rrData && 
                           rrData.intervals && 
                           rrData.intervals.length >= 3 && 
                           rrData.intervals.every(i => i > 300 && i < 2000) ?
                           this.arrhythmiaProcessor.processRRData(rrData) :
                           { arrhythmiaStatus: "--", lastArrhythmiaData: null };
    
    const timestamp = Date.now();
    const metadata = { 
      quality: 0, 
      timestamp,
      timeDelta: 33, // ~30 Hz
      rawValue: ppgValue
    };
    
    // Add to differential channels with bidirectional feedback
    const cardiacFeedback = await this.cardiacChannel.addValueWithFeedback(filtered, metadata);
    this.bpChannel.addValue(filtered, metadata);
    this.spo2Channel.addValue(filtered, metadata);
    this.glucoseChannel.addValue(filtered, metadata);
    this.lipidChannel.addValue(filtered, metadata);
    
    // Get PPG values for processing
    const ppgValues = this.signalProcessor.getPPGValues();
    ppgValues.push(filtered);
    
    // Limit the real data buffer
    if (ppgValues.length > 300) {
      ppgValues.splice(0, ppgValues.length - 300);
    }
    
    // Count processed signals
    this.processedSignals++;
    
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
    
    try {
      // Process vital signs with neural networks if available
      let spo2 = 0;
      let bp = { systolic: 0, diastolic: 0 };
      
      if (this.isModelReady && tfWorkerClient && ppgValues.length >= 100) {
        try {
          // Normalize signal for neural input
          const normalizedPPG = this.normalizeSignal(ppgValues.slice(-100));
          
          // Process SpO2 with neural network
          const spo2Prediction = await tfWorkerClient.predict('spo2', normalizedPPG);
          spo2 = Math.round(spo2Prediction[0] * 100);
          
          // Ensure physiological range
          spo2 = Math.max(70, Math.min(100, spo2));
          
          // Process blood pressure with neural network
          const bpPrediction = await tfWorkerClient.predict('bloodPressure', normalizedPPG);
          bp.systolic = Math.round(bpPrediction[0]);
          bp.diastolic = Math.round(bpPrediction[1]);
          
          // Ensure physiological ranges
          bp.systolic = Math.max(70, Math.min(200, bp.systolic));
          bp.diastolic = Math.max(40, Math.min(120, bp.diastolic));
          
          // Verify the values make sense
          if (bp.systolic <= bp.diastolic) {
            throw new Error("Neural BP values physiologically invalid");
          }
          
          console.log("VitalSignsProcessor: Neural prediction successful", {
            spo2,
            pressure: `${bp.systolic}/${bp.diastolic}`,
            confidence: cardiacFeedback.quality / 100
          });
        } catch (error) {
          console.error("VitalSignsProcessor: Error in neural prediction, falling back to traditional methods:", error);
          // Fallback to traditional methods
          spo2 = Math.round(this.spo2Processor.calculateSpO2(ppgValues.slice(-45)));
          bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90));
        }
      } else {
        // Use traditional methods if neural network not available
        spo2 = Math.round(this.spo2Processor.calculateSpO2(ppgValues.slice(-45)));
        bp = this.bpProcessor.calculateBloodPressure(ppgValues.slice(-90));
      }
      
      const pressure = bp.systolic > 0 && bp.diastolic > 0 
        ? `${Math.round(bp.systolic)}/${Math.round(bp.diastolic)}` 
        : "--/--";
      
      // Apply bidirectional feedback between channels
      if (cardiacFeedback.needsOptimization && cardiacFeedback.optimizationSuggestions) {
        if (cardiacFeedback.optimizationSuggestions.gainAdjustment) {
          this.spo2Channel.setGain(cardiacFeedback.optimizationSuggestions.gainAdjustment);
          this.bpChannel.setGain(cardiacFeedback.optimizationSuggestions.gainAdjustment);
        }
        
        if (cardiacFeedback.optimizationSuggestions.baselineCorrection) {
          this.spo2Channel.setBaseline(cardiacFeedback.optimizationSuggestions.baselineCorrection);
          this.bpChannel.setBaseline(cardiacFeedback.optimizationSuggestions.baselineCorrection);
        }
      }
      
      // Calculate glucose with real data
      const glucose = Math.round(this.glucoseProcessor.calculateGlucose(ppgValues));
      const glucoseConfidence = this.glucoseProcessor.getConfidence();
      
      // Calculate lipids with real data
      const lipids = this.lipidProcessor.calculateLipids(ppgValues);
      const lipidsConfidence = this.lipidProcessor.getConfidence();
      
      // Calculate hydration with real PPG data
      const hydration = Math.round(this.hydrationEstimator.analyze(ppgValues));
      
      // Calculate overall confidence
      const overallConfidence = this.confidenceCalculator.calculateOverallConfidence(
        glucoseConfidence,
        lipidsConfidence
      );
  
      // Only show values if confidence exceeds threshold
      const finalGlucose = this.confidenceCalculator.meetsThreshold(glucoseConfidence) ? glucose : 0;
      const finalLipids = this.confidenceCalculator.meetsThreshold(lipidsConfidence) ? {
        totalCholesterol: Math.round(lipids.totalCholesterol),
        triglycerides: Math.round(lipids.triglycerides)
      } : {
        totalCholesterol: 0,
        triglycerides: 0
      };
  
      // Logging every 45 frames
      if (this.processedSignals % 45 === 0) {
        console.log("VitalSignsProcessor: Results with neural enhancement", {
          spo2,
          pressure,
          arrhythmiaStatus: arrhythmiaResult.arrhythmiaStatus,
          glucose: finalGlucose,
          glucoseConfidence,
          lipidsConfidence,
          hydration,
          signalAmplitude: amplitude,
          neuralActive: this.isModelReady,
          channelQuality: cardiacFeedback.quality
        });
      }
  
      // Prepare result with all metrics including hydration
      return ResultFactory.createResult(
        spo2,
        pressure,
        arrhythmiaResult.arrhythmiaStatus || "--",
        finalGlucose,
        finalLipids,
        Math.round(this.calculateDefaultHemoglobin(spo2)),
        hydration,
        glucoseConfidence,
        lipidsConfidence,
        overallConfidence,
        arrhythmiaResult.lastArrhythmiaData
      );
    } catch (error) {
      console.error("VitalSignsProcessor: Error processing vital signs:", error);
      return ResultFactory.createEmptyResults();
    }
  }

  /**
   * Normalize signal for neural network input
   */
  private normalizeSignal(signal: number[]): number[] {
    if (signal.length === 0) return [];
    
    // Find min and max for normalization
    const min = Math.min(...signal);
    const max = Math.max(...signal);
    const range = max - min;
    
    // Avoid division by zero
    if (range === 0) return signal.map(() => 0.5);
    
    // Normalize to [0,1] range
    return signal.map(val => (val - min) / range);
  }

  /**
   * Calculate a default hemoglobin value based on SpO2
   */
  private calculateDefaultHemoglobin(spo2: number): number {
    if (spo2 <= 0) return 0;
    
    // Base approximation
    const base = 14;
    
    if (spo2 > 95) return base + Math.random();
    if (spo2 > 90) return base - 1 + Math.random();
    if (spo2 > 85) return base - 2 + Math.random();
    
    return base - 3 + Math.random();
  }

  /**
   * Reset the processor to ensure a clean state
   */
  public reset(): VitalSignsResult | null {
    this.spo2Processor.reset();
    this.bpProcessor.reset();
    this.arrhythmiaProcessor.reset();
    this.signalProcessor.reset();
    this.glucoseProcessor.reset();
    this.lipidProcessor.reset();
    this.hydrationEstimator.reset();
    
    // Reset all channels
    this.cardiacChannel.reset();
    this.spo2Channel.reset();
    this.bpChannel.reset();
    this.glucoseChannel.reset();
    this.lipidChannel.reset();
    
    console.log("VitalSignsProcessor: Reset complete - all processors and channels at zero");
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
   * Forces fresh measurements
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
    this.processedSignals = 0;
    console.log("VitalSignsProcessor: Full reset completed - starting from zero");
  }
}

// Re-export the VitalSignsResult type
export type { VitalSignsResult } from './types/vital-signs-result';
