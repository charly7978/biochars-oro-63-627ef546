
/**
 * Neural pipeline for PPG signal processing
 * Implements pre-processing, model inference, and signal enhancement
 */
import { tensorflowService, ModelType, InferenceOptions } from './tensorflow-service';

export interface NeuralProcessingOptions extends InferenceOptions {
  // Additional neural processing options
  useDenoising?: boolean;
  useTemporalModels?: boolean;
  signalWindowSize?: number;
}

export interface NeuralProcessingResult {
  // Output values for each vital sign
  spo2?: number;
  bloodPressure?: { systolic: number, diastolic: number };
  glucose?: number;
  lipids?: { totalCholesterol: number, triglycerides: number };
  heartRate?: number;
  
  // Confidence values
  confidence: {
    spo2?: number;
    bloodPressure?: number;
    glucose?: number;
    lipids?: number;
    heartRate?: number;
    overall: number;
  };
  
  // Enhanced signal if denoising was applied
  enhancedSignal?: number[];
  
  // Processing metrics
  processingTime?: number;
  webgpuUsed?: boolean;
}

export class NeuralPipeline {
  private defaultOptions: NeuralProcessingOptions = {
    useWebGPU: true,
    useDenoising: true,
    useTemporalModels: true,
    signalWindowSize: 100,
    batchSize: 1,
    confidenceThreshold: 0.5
  };
  
  /**
   * Process a PPG signal with neural networks to extract vital signs
   */
  public async process(
    signal: number[],
    options?: Partial<NeuralProcessingOptions>
  ): Promise<NeuralProcessingResult> {
    const startTime = performance.now();
    const mergedOptions = { ...this.defaultOptions, ...options };
    const result: NeuralProcessingResult = {
      confidence: {
        overall: 0
      }
    };
    
    try {
      // Check if we have enough data
      if (!signal || !Array.isArray(signal) || signal.length < 30) {
        console.warn('NeuralPipeline: Not enough data for processing');
        return this.createEmptyResult();
      }
      
      // 1. Apply denoising/enhancement if enabled
      let processedSignal = signal;
      if (mergedOptions.useDenoising) {
        processedSignal = await tensorflowService.enhanceSignal(signal);
        result.enhancedSignal = processedSignal;
      }
      
      // 2. Process each vital sign with appropriate model
      const [spo2Result, bpResult, glucoseResult, lipidsResult, heartRateResult] = await Promise.all([
        this.processSpo2(processedSignal, mergedOptions),
        this.processBloodPressure(processedSignal, mergedOptions),
        this.processGlucose(processedSignal, mergedOptions),
        this.processLipids(processedSignal, mergedOptions),
        this.processHeartRate(processedSignal, mergedOptions)
      ]);
      
      // 3. Add results to output
      if (spo2Result) {
        result.spo2 = spo2Result.value;
        result.confidence.spo2 = spo2Result.confidence;
      }
      
      if (bpResult) {
        result.bloodPressure = bpResult.value;
        result.confidence.bloodPressure = bpResult.confidence;
      }
      
      if (glucoseResult) {
        result.glucose = glucoseResult.value;
        result.confidence.glucose = glucoseResult.confidence;
      }
      
      if (lipidsResult) {
        result.lipids = lipidsResult.value;
        result.confidence.lipids = lipidsResult.confidence;
      }
      
      if (heartRateResult) {
        result.heartRate = heartRateResult.value;
        result.confidence.heartRate = heartRateResult.confidence;
      }
      
      // 4. Calculate overall confidence
      result.confidence.overall = this.calculateOverallConfidence(result.confidence);
      
      // 5. Add processing metrics
      result.processingTime = performance.now() - startTime;
      result.webgpuUsed = tensorflowService.isWebGPUAvailable();
      
      return result;
    } catch (error) {
      console.error('NeuralPipeline: Error processing signal:', error);
      
      // Return empty result with processing time for analytics
      const emptyResult = this.createEmptyResult();
      emptyResult.processingTime = performance.now() - startTime;
      return emptyResult;
    }
  }
  
  /**
   * Process SpO2 with neural model
   */
  private async processSpo2(
    signal: number[],
    options: NeuralProcessingOptions
  ): Promise<{value: number, confidence: number} | null> {
    try {
      const result = await tensorflowService.runInference(
        signal,
        ModelType.SPO2,
        'v1',
        options
      );
      
      // Ensure value is in physiological range (90-100%)
      const spo2 = Math.min(100, Math.max(90, result.prediction[0]));
      
      return {
        value: spo2,
        confidence: result.confidence
      };
    } catch (error) {
      console.error('NeuralPipeline: Error processing SpO2:', error);
      return null;
    }
  }
  
  /**
   * Process blood pressure with neural model
   */
  private async processBloodPressure(
    signal: number[],
    options: NeuralProcessingOptions
  ): Promise<{value: {systolic: number, diastolic: number}, confidence: number} | null> {
    try {
      const result = await tensorflowService.runInference(
        signal,
        ModelType.BLOOD_PRESSURE,
        'v1',
        options
      );
      
      // Model should output [systolic, diastolic, confidence]
      if (result.prediction.length < 2) {
        return null;
      }
      
      // Ensure values are in physiological range
      const systolic = Math.min(180, Math.max(90, result.prediction[0]));
      const diastolic = Math.min(120, Math.max(60, result.prediction[1]));
      
      return {
        value: {
          systolic: Math.round(systolic),
          diastolic: Math.round(diastolic)
        },
        confidence: result.confidence
      };
    } catch (error) {
      console.error('NeuralPipeline: Error processing blood pressure:', error);
      return null;
    }
  }
  
  /**
   * Process glucose with neural model
   */
  private async processGlucose(
    signal: number[],
    options: NeuralProcessingOptions
  ): Promise<{value: number, confidence: number} | null> {
    try {
      const result = await tensorflowService.runInference(
        signal,
        ModelType.GLUCOSE,
        'v1',
        options
      );
      
      // Ensure value is in physiological range (70-200 mg/dL)
      const glucose = Math.min(200, Math.max(70, result.prediction[0]));
      
      return {
        value: Math.round(glucose),
        confidence: result.confidence
      };
    } catch (error) {
      console.error('NeuralPipeline: Error processing glucose:', error);
      return null;
    }
  }
  
  /**
   * Process lipids with neural model
   */
  private async processLipids(
    signal: number[],
    options: NeuralProcessingOptions
  ): Promise<{value: {totalCholesterol: number, triglycerides: number}, confidence: number} | null> {
    try {
      const result = await tensorflowService.runInference(
        signal,
        ModelType.LIPIDS,
        'v1',
        options
      );
      
      // Model should output [totalCholesterol, triglycerides, confidence]
      if (result.prediction.length < 2) {
        return null;
      }
      
      // Ensure values are in physiological range
      const totalCholesterol = Math.min(300, Math.max(120, result.prediction[0]));
      const triglycerides = Math.min(300, Math.max(50, result.prediction[1]));
      
      return {
        value: {
          totalCholesterol: Math.round(totalCholesterol),
          triglycerides: Math.round(triglycerides)
        },
        confidence: result.confidence
      };
    } catch (error) {
      console.error('NeuralPipeline: Error processing lipids:', error);
      return null;
    }
  }
  
  /**
   * Process heart rate with neural model
   */
  private async processHeartRate(
    signal: number[],
    options: NeuralProcessingOptions
  ): Promise<{value: number, confidence: number} | null> {
    try {
      const result = await tensorflowService.runInference(
        signal,
        ModelType.CARDIAC,
        'v1',
        options
      );
      
      // Ensure value is in physiological range (40-180 bpm)
      const heartRate = Math.min(180, Math.max(40, result.prediction[0]));
      
      return {
        value: Math.round(heartRate),
        confidence: result.confidence
      };
    } catch (error) {
      console.error('NeuralPipeline: Error processing heart rate:', error);
      return null;
    }
  }
  
  /**
   * Calculate overall confidence based on individual confidences
   */
  private calculateOverallConfidence(confidence: NeuralProcessingResult['confidence']): number {
    const values = [
      confidence.spo2 || 0,
      confidence.bloodPressure || 0,
      confidence.glucose || 0,
      confidence.lipids || 0,
      confidence.heartRate || 0
    ];
    
    // Filter out zeros
    const validValues = values.filter(v => v > 0);
    
    if (validValues.length === 0) {
      return 0;
    }
    
    // Calculate weighted average
    return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
  }
  
  /**
   * Create an empty result object for error cases
   */
  private createEmptyResult(): NeuralProcessingResult {
    return {
      confidence: {
        overall: 0
      }
    };
  }
}

// Export a singleton instance
export const neuralPipeline = new NeuralPipeline();
