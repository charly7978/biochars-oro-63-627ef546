
/**
 * Blood Pressure Processor
 * Specialized processor for extracting blood pressure from PPG signals
 */
import { tensorflowService, ModelType } from '../ai/tensorflow-service';

interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  map: number;
  confidence: number;
}

/**
 * Processes PPG signals to extract blood pressure values
 */
export class BloodPressureProcessor {
  private isAIEnabled: boolean = false;
  private lastValidResult: BloodPressureResult | null = null;
  private isModelLoaded: boolean = false;
  private processingOptions: {
    useEnhancement: boolean;
    confidenceThreshold: number;
    traditionalWeight: number;
  };
  
  constructor(options?: {
    useAI?: boolean;
    useEnhancement?: boolean;
    confidenceThreshold?: number;
    traditionalWeight?: number;
  }) {
    this.isAIEnabled = options?.useAI ?? true;
    this.processingOptions = {
      useEnhancement: options?.useEnhancement ?? true,
      confidenceThreshold: options?.confidenceThreshold ?? 0.5,
      traditionalWeight: options?.traditionalWeight ?? 0.4
    };
    
    // Load model if AI is enabled
    if (this.isAIEnabled) {
      this.loadModel();
    }
  }
  
  /**
   * Load TensorFlow model for blood pressure analysis
   */
  private async loadModel(): Promise<void> {
    try {
      const model = await tensorflowService.loadModel(ModelType.BLOOD_PRESSURE);
      this.isModelLoaded = !!model;
      console.log("Blood pressure model loaded:", this.isModelLoaded);
    } catch (error) {
      console.error("Error loading blood pressure model:", error);
      this.isModelLoaded = false;
    }
  }
  
  /**
   * Process a PPG signal to extract blood pressure
   * This is the main method to calculate blood pressure (async version)
   */
  public async process(value: number): Promise<BloodPressureResult> {
    // Base calculation using traditional method
    const traditionalResult = this.traditionalCalculation(value);
    
    // Apply AI enhancement if enabled and model is loaded
    if (this.isAIEnabled && this.isModelLoaded) {
      try {
        const aiResult = await this.aiEnhancedCalculation(value);
        
        // Blend results if AI confidence is high enough
        if (aiResult.confidence >= this.processingOptions.confidenceThreshold) {
          const traditionalWeight = this.processingOptions.traditionalWeight;
          const aiWeight = 1 - traditionalWeight;
          
          const blendedResult: BloodPressureResult = {
            systolic: Math.round(traditionalResult.systolic * traditionalWeight + aiResult.systolic * aiWeight),
            diastolic: Math.round(traditionalResult.diastolic * traditionalWeight + aiResult.diastolic * aiWeight),
            map: Math.round(traditionalResult.map * traditionalWeight + aiResult.map * aiWeight),
            confidence: aiResult.confidence
          };
          
          this.lastValidResult = blendedResult;
          return blendedResult;
        }
      } catch (error) {
        console.error("Error in AI blood pressure processing:", error);
      }
    }
    
    // Store and return traditional result if AI failed or is disabled
    this.lastValidResult = traditionalResult;
    return traditionalResult;
  }
  
  /**
   * Synchronous version of blood pressure calculation
   * For use when async processing is not possible
   */
  public processSync(value: number): BloodPressureResult {
    // Use traditional calculation directly for sync method
    const result = this.traditionalCalculation(value);
    this.lastValidResult = result;
    return result;
  }
  
  /**
   * Calculate blood pressure using traditional algorithm
   */
  private traditionalCalculation(value: number): BloodPressureResult {
    // Basic algorithm (simplified for demo)
    const baseSystolic = 120;
    const baseDiastolic = 80;
    
    // Apply some variation based on the signal value
    const systolic = Math.round(baseSystolic + value * 10);
    const diastolic = Math.round(baseDiastolic + value * 5);
    const map = Math.round(diastolic + (systolic - diastolic) / 3);
    
    return {
      systolic,
      diastolic,
      map,
      confidence: 0.7 // Fixed confidence for traditional method
    };
  }
  
  /**
   * Calculate blood pressure using AI model
   */
  private async aiEnhancedCalculation(value: number): Promise<BloodPressureResult> {
    // Run inference
    const inferenceResult = await tensorflowService.runInference([value], ModelType.BLOOD_PRESSURE);
    
    // Extract predictions (assuming model outputs [systolic, diastolic])
    const systolic = Math.round(inferenceResult.prediction[0]);
    const diastolic = Math.round(inferenceResult.prediction[1]);
    const map = Math.round(diastolic + (systolic - diastolic) / 3);
    
    return {
      systolic,
      diastolic,
      map,
      confidence: inferenceResult.confidence
    };
  }
  
  /**
   * Get the last valid result
   */
  public getLastValidResult(): BloodPressureResult | null {
    return this.lastValidResult;
  }
  
  /**
   * Get the confidence score of the latest measurement
   */
  public getConfidence(): number {
    return this.lastValidResult?.confidence ?? 0;
  }
  
  /**
   * Enable or disable AI processing
   */
  public setAIEnabled(enabled: boolean): void {
    this.isAIEnabled = enabled;
    
    // Load model if enabling AI and model not loaded
    if (enabled && !this.isModelLoaded) {
      this.loadModel();
    }
  }
  
  /**
   * Update processing options
   */
  public updateOptions(options: Partial<typeof this.processingOptions>): void {
    this.processingOptions = { ...this.processingOptions, ...options };
  }

  /**
   * Reset the processor state
   */
  public reset(): void {
    this.lastValidResult = null;
    console.log("BloodPressureProcessor: Reset complete");
  }
}
