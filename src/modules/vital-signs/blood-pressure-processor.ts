
import { calculateAmplitude, findPeaksAndValleys } from './utils';
import { BloodPressureAnalyzer, BloodPressureResult } from '../../core/analysis/BloodPressureAnalyzer';
import { SignalOptimizationManager } from '../../core/signal/SignalOptimizationManager';
import { BloodPressureNeuralModel } from '../../core/neural/BloodPressureModel';

export class BloodPressureProcessor {
  // Buffer size for calculations
  private readonly BP_BUFFER_SIZE = 15;
  // Measurement history
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  // Physiological boundaries
  private readonly MIN_SYSTOLIC = 80;
  private readonly MAX_SYSTOLIC = 190;
  private readonly MIN_DIASTOLIC = 50;
  private readonly MAX_DIASTOLIC = 120;
  private readonly MIN_PULSE_PRESSURE = 25;
  private readonly MAX_PULSE_PRESSURE = 70;
  // Signal quality thresholds
  private readonly MIN_SIGNAL_AMPLITUDE = 0.001;
  private readonly MIN_PEAK_COUNT = 1;
  
  // Core analyzer using direct physiological calculations
  private analyzer: BloodPressureAnalyzer;
  // Neural model for enhanced prediction
  private neuralModel: BloodPressureNeuralModel;
  // Signal optimization manager for improved signal quality
  private signalOptimizer: SignalOptimizationManager;
  
  private lastCalculationTime: number = 0;
  private forceRecalculationInterval: number = 2000;
  
  // Feedback data for optimization
  private feedbackMetrics: {
    accuracy: number;
    stability: number;
    physiologicalValidity: number;
  } = {
    accuracy: 0.5,
    stability: 0.5,
    physiologicalValidity: 0.5
  };
  
  constructor() {
    this.analyzer = new BloodPressureAnalyzer();
    this.neuralModel = new BloodPressureNeuralModel();
    this.signalOptimizer = new SignalOptimizationManager();
    
    console.log("BloodPressureProcessor: Initialized with neural model and signal optimization");
  }

  /**
   * Calculates blood pressure using real PPG signal features
   * Integrates signal optimization, neural prediction and traditional analysis
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
    map?: number;
    confidence?: number;
  } {
    const currentTime = Date.now();
    
    // Basic check to ensure we have some data
    if (!values || values.length === 0) {
      console.log("BloodPressureProcessor: Empty signal received");
      return { systolic: 0, diastolic: 0 };
    }

    // Check signal quality
    const signalAmplitude = Math.max(...values) - Math.min(...values);
    if (values.length < 15 || signalAmplitude < this.MIN_SIGNAL_AMPLITUDE) {
      console.log("BloodPressureProcessor: Insufficient signal quality", {
        length: values.length,
        amplitude: signalAmplitude,
        threshold: this.MIN_SIGNAL_AMPLITUDE
      });
      return { systolic: 0, diastolic: 0 };
    }

    // Update calculation time
    this.lastCalculationTime = currentTime;
    
    // Step 1: Apply signal optimization with bidirectional feedback
    const optimizedSignal = this.optimizeSignal(values);
    
    // Step 2: Get traditional physiological analysis
    const analyzerResult = this.analyzer.calculateBloodPressure(optimizedSignal.signalData);
    
    // Step 3: Get neural model prediction
    const neuralPrediction = this.neuralModel.predict(optimizedSignal.signalData);
    
    // Step 4: Combine results with weighted fusion based on signal quality and confidence
    const fusedResult = this.fuseResults(
      analyzerResult, 
      { systolic: neuralPrediction[0], diastolic: neuralPrediction[1] },
      optimizedSignal.quality
    );
    
    // Step 5: Apply feedback based on results
    this.provideFeedback(fusedResult, optimizedSignal.quality);
    
    // Store results in buffer for stability
    if (fusedResult.systolic > 0 && fusedResult.diastolic > 0) {
      this.systolicBuffer.push(fusedResult.systolic);
      this.diastolicBuffer.push(fusedResult.diastolic);
      
      // Maintain buffer size
      if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
        this.systolicBuffer.shift();
        this.diastolicBuffer.shift();
      }
    }

    // Validate results are within physiological range
    return {
      systolic: this.validateSystolic(fusedResult.systolic),
      diastolic: this.validateDiastolic(fusedResult.diastolic, fusedResult.systolic),
      map: fusedResult.map || Math.round((fusedResult.systolic + 2 * fusedResult.diastolic) / 3),
      confidence: fusedResult.confidence
    };
  }
  
  /**
   * Optimize the PPG signal using the SignalOptimizationManager
   * and apply bidirectional feedback
   */
  private optimizeSignal(values: number[]): { 
    signalData: number[], 
    quality: number 
  } {
    // Create a processed signal to feed into optimizer
    const processedSignal = {
      rawValue: values[values.length - 1],
      filteredValue: values[values.length - 1],
      quality: 0
    };
    
    // Process through signal optimization manager
    const optimizationResult = this.signalOptimizer.processSignal(processedSignal);
    
    // Get the optimized channel for blood pressure
    const bpChannel = optimizationResult.optimizedChannels.get('bloodPressure') || 
                    optimizationResult.optimizedChannels.get('heartRate');
    
    // If we have an optimized channel, use it, otherwise use original signal
    const optimizedValues = bpChannel ? bpChannel.values : values;
    const signalQuality = bpChannel ? bpChannel.quality / 100 : 0.5;
    
    // Apply bidirectional feedback to optimize signal
    this.signalOptimizer.provideFeedback('bloodPressure', {
      accuracy: this.feedbackMetrics.accuracy,
      stability: this.feedbackMetrics.stability,
      confidence: this.feedbackMetrics.physiologicalValidity
    });
    
    return {
      signalData: optimizedValues.slice(-300), // Take last 300 samples for processing
      quality: signalQuality
    };
  }
  
  /**
   * Fuse results from traditional and neural approaches
   * based on signal quality and confidence
   */
  private fuseResults(
    analyzerResult: BloodPressureResult,
    neuralResult: { systolic: number, diastolic: number },
    signalQuality: number
  ): BloodPressureResult {
    // Weight factors based on signal quality
    // Higher quality signal gives more weight to neural model
    const analyzerWeight = Math.max(0.3, 1 - signalQuality);
    const neuralWeight = Math.max(0.3, signalQuality);
    const totalWeight = analyzerWeight + neuralWeight;
    
    // Compute weighted average
    const fusedSystolic = Math.round(
      (analyzerResult.systolic * analyzerWeight + neuralResult.systolic * neuralWeight) / totalWeight
    );
    
    const fusedDiastolic = Math.round(
      (analyzerResult.diastolic * analyzerWeight + neuralResult.diastolic * neuralWeight) / totalWeight
    );
    
    // Use analyzer's MAP calculation if available
    const fusedMap = analyzerResult.map || Math.round((fusedSystolic + 2 * fusedDiastolic) / 3);
    
    // Compute fused confidence
    const fusedConfidence = analyzerResult.confidence !== undefined ?
      (analyzerResult.confidence * analyzerWeight + signalQuality * neuralWeight) / totalWeight :
      signalQuality;
    
    console.log("BloodPressureProcessor: Fusion weights", {
      analyzerWeight,
      neuralWeight,
      signalQuality,
      analyzerValues: [analyzerResult.systolic, analyzerResult.diastolic],
      neuralValues: [neuralResult.systolic, neuralResult.diastolic],
      fusedValues: [fusedSystolic, fusedDiastolic],
      confidence: fusedConfidence
    });
    
    return {
      systolic: fusedSystolic,
      diastolic: fusedDiastolic,
      map: fusedMap,
      confidence: fusedConfidence
    };
  }
  
  /**
   * Provide feedback to improve future measurements
   */
  private provideFeedback(result: BloodPressureResult, signalQuality: number): void {
    // Calculate stability from buffer
    let stability = 0.5;
    
    if (this.systolicBuffer.length >= 3) {
      const systolicVariation = this.calculateVariation(this.systolicBuffer);
      const diastolicVariation = this.calculateVariation(this.diastolicBuffer);
      
      // Lower variation = higher stability
      stability = Math.max(0, Math.min(1, 1 - (systolicVariation + diastolicVariation) / 2));
    }
    
    // Calculate physiological validity
    const pulsePress = result.systolic - result.diastolic;
    const isPhysiologicalValid = 
      result.systolic > 90 && result.systolic < 180 &&
      result.diastolic > 50 && result.diastolic < 110 &&
      pulsePress > 20 && pulsePress < 80;
    
    const physiologicalValidity = isPhysiologicalValid ? Math.max(0.6, signalQuality) : 0.3;
    
    // Accuracy estimate (simplified)
    const accuracy = result.confidence || signalQuality;
    
    // Update feedback metrics with smoothing
    this.feedbackMetrics = {
      accuracy: this.feedbackMetrics.accuracy * 0.7 + accuracy * 0.3,
      stability: this.feedbackMetrics.stability * 0.7 + stability * 0.3,
      physiologicalValidity: this.feedbackMetrics.physiologicalValidity * 0.7 + physiologicalValidity * 0.3
    };
    
    console.log("BloodPressureProcessor: Feedback metrics updated", this.feedbackMetrics);
  }
  
  /**
   * Calculate variation coefficient for feedback
   */
  private calculateVariation(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev / mean; // Coefficient of variation
  }

  /**
   * Ensures systolic pressure is within physiological range
   */
  private validateSystolic(systolic: number): number {
    if (systolic <= 0) return 0;
    return Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, systolic));
  }
  
  /**
   * Ensures diastolic pressure is within physiological range
   * and maintains proper relationship with systolic
   */
  private validateDiastolic(diastolic: number, systolic: number): number {
    if (diastolic <= 0) return 0;
    
    let validDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, diastolic));
    
    // Ensure proper differential between systolic and diastolic
    const differential = systolic - validDiastolic;
    
    if (differential < this.MIN_PULSE_PRESSURE) {
      validDiastolic = systolic - this.MIN_PULSE_PRESSURE;
    } else if (differential > this.MAX_PULSE_PRESSURE) {
      validDiastolic = systolic - this.MAX_PULSE_PRESSURE;
    }
    
    // Recheck physiological limits
    return Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, validDiastolic));
  }
  
  /**
   * Reset the blood pressure processor state
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.lastCalculationTime = 0;
    this.analyzer.reset();
    this.signalOptimizer.reset();
    this.feedbackMetrics = {
      accuracy: 0.5,
      stability: 0.5,
      physiologicalValidity: 0.5
    };
    console.log("BloodPressureProcessor: Reset completed");
  }
}
