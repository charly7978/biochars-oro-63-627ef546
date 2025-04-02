import * as tf from '@tensorflow/tfjs';

interface ArrhythmiaDetectionConfig {
  windowSize: number;
  minPeakDistance: number;
  maxRmssdThreshold: number;
  detectionConfidenceThreshold: number;
  useTensorFlow: boolean;
}

interface ArrhythmiaResult {
  isArrhythmia: boolean;
  timestamp: number;
  confidence: number;
  type?: 'premature' | 'missed' | 'irregularity' | 'tachycardia' | 'bradycardia';
  rmssd: number;
  rrVariation: number;
  hrvFeatures?: {
    sdnn: number;
    pnn50: number;
    lfHfRatio: number;
  };
}

export class ArrhythmiaDetector {
  private rrIntervals: number[] = [];
  private lastDetectionTime: number = 0;
  private model: tf.LayersModel | null = null;
  private isModelLoading: boolean = false;
  private arrhythmiaCount: number = 0;
  private recentDetections: ArrhythmiaResult[] = [];
  private readonly DEFAULT_CONFIG: ArrhythmiaDetectionConfig = {
    windowSize: 8,
    minPeakDistance: 300,
    maxRmssdThreshold: 120,
    detectionConfidenceThreshold: 0.7,
    useTensorFlow: true
  };
  
  private config: ArrhythmiaDetectionConfig;
  
  constructor(config?: Partial<ArrhythmiaDetectionConfig>) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    
    // Load TensorFlow model if enabled
    if (this.config.useTensorFlow) {
      this.loadModel();
    }
  }
  
  /**
   * Load the arrhythmia detection model
   */
  private async loadModel(): Promise<void> {
    if (this.model || this.isModelLoading) return;
    
    this.isModelLoading = true;
    
    try {
      // We're creating a simple model for RR interval analysis
      this.model = tf.sequential();
      
      // Input shape is [windowSize] for a sequence of RR intervals
      this.model.add(tf.layers.dense({
        inputShape: [this.config.windowSize],
        units: 16,
        activation: 'relu'
      }));
      
      this.model.add(tf.layers.dense({
        units: 8,
        activation: 'relu'
      }));
      
      this.model.add(tf.layers.dense({
        units: 1,
        activation: 'sigmoid'
      }));
      
      this.model.compile({
        optimizer: tf.train.adam(),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });
      
      this.isModelLoading = false;
      console.log('Arrhythmia detection model created successfully');
    } catch (error) {
      console.error('Failed to create arrhythmia detection model:', error);
      this.isModelLoading = false;
      this.model = null;
    }
  }
  
  /**
   * Process new RR interval and detect arrhythmias
   */
  public processRRInterval(interval: number): ArrhythmiaResult | null {
    if (interval <= 0 || interval > 2500) {
      return null; // Invalid interval
    }
    
    // Add to the intervals array
    this.rrIntervals.push(interval);
    
    // Keep only the most recent intervals
    if (this.rrIntervals.length > this.config.windowSize * 2) {
      this.rrIntervals = this.rrIntervals.slice(-this.config.windowSize * 2);
    }
    
    // Need at least a few intervals to detect arrhythmias
    if (this.rrIntervals.length < this.config.windowSize) {
      return null;
    }
    
    // Get the most recent intervals for analysis
    const recentIntervals = this.rrIntervals.slice(-this.config.windowSize);
    
    // Calculate statistics
    const stats = this.calculateStatistics(recentIntervals);
    
    // First, check for arrhythmia using traditional methods
    const traditionalResult = this.detectArrhythmiaTraditional(recentIntervals, stats);
    
    // If we have a TensorFlow model, enhance the detection
    let enhancedConfidence = traditionalResult.confidence;
    if (this.model && this.config.useTensorFlow) {
      try {
        // Normalize intervals
        const mean = stats.mean;
        const std = stats.std > 0 ? stats.std : 1;
        const normalizedIntervals = recentIntervals.map(rr => (rr - mean) / std);
        
        // Make prediction
        const tensor = tf.tensor2d([normalizedIntervals], [1, this.config.windowSize]);
        const prediction = this.model.predict(tensor) as tf.Tensor;
        const confidence = prediction.dataSync()[0];
        
        // Blend traditional and ML-based confidence
        enhancedConfidence = (traditionalResult.confidence * 0.6) + (confidence * 0.4);
        
        // Cleanup
        tensor.dispose();
        prediction.dispose();
      } catch (error) {
        console.error('Error in TensorFlow arrhythmia prediction:', error);
      }
    }
    
    // Final arrhythmia determination
    const isArrhythmia = enhancedConfidence >= this.config.detectionConfidenceThreshold;
    
    if (isArrhythmia) {
      // Only count as new if sufficient time has passed
      const now = Date.now();
      const timeSinceLastDetection = now - this.lastDetectionTime;
      
      if (timeSinceLastDetection > 2000) { // At least 2 seconds between counted arrhythmias
        this.arrhythmiaCount++;
        this.lastDetectionTime = now;
      }
      
      // Create arrhythmia result
      const result: ArrhythmiaResult = {
        isArrhythmia: true,
        timestamp: Date.now(),
        confidence: enhancedConfidence,
        type: this.determineArrhythmiaType(recentIntervals, stats),
        rmssd: stats.rmssd,
        rrVariation: stats.variation,
        hrvFeatures: {
          sdnn: stats.std,
          pnn50: stats.pnn50,
          lfHfRatio: 0 // Would require frequency domain analysis
        }
      };
      
      // Store detection for trending
      this.recentDetections.push(result);
      if (this.recentDetections.length > 10) {
        this.recentDetections.shift();
      }
      
      return result;
    }
    
    return {
      isArrhythmia: false,
      timestamp: Date.now(),
      confidence: enhancedConfidence,
      rmssd: stats.rmssd,
      rrVariation: stats.variation
    };
  }
  
  /**
   * Traditional arrhythmia detection using statistical methods
   */
  private detectArrhythmiaTraditional(
    intervals: number[], 
    stats: { 
      mean: number, 
      std: number, 
      rmssd: number, 
      pnn50: number, 
      variation: number 
    }
  ): { isArrhythmia: boolean, confidence: number, type?: string } {
    // Check variance - high variance can indicate arrhythmia
    const variationThreshold = 0.15; // 15% variation is suspicious
    const rmssdThreshold = 50;      // Higher RMSSD can indicate arrhythmia
    
    // Basic rule-based detection
    const highVariation = stats.variation > variationThreshold;
    const highRmssd = stats.rmssd > rmssdThreshold;
    
    // Check for sudden changes
    let hasSuddenChange = false;
    for (let i = 1; i < intervals.length; i++) {
      const changePercent = Math.abs(intervals[i] - intervals[i-1]) / intervals[i-1];
      if (changePercent > 0.3) { // 30% sudden change is suspicious
        hasSuddenChange = true;
        break;
      }
    }
    
    // Calculate confidence based on multiple factors
    let confidence = 0;
    if (highVariation) confidence += 0.3;
    if (highRmssd) confidence += 0.3;
    if (hasSuddenChange) confidence += 0.4;
    
    // Clamp confidence
    confidence = Math.min(confidence, 1.0);
    
    return {
      isArrhythmia: confidence > this.config.detectionConfidenceThreshold,
      confidence: confidence
    };
  }
  
  /**
   * Determine the specific type of arrhythmia
   */
  private determineArrhythmiaType(
    intervals: number[],
    stats: { mean: number, std: number }
  ): ArrhythmiaResult['type'] {
    // Check for premature beat (short interval followed by long one)
    for (let i = 1; i < intervals.length - 1; i++) {
      if (intervals[i] < stats.mean * 0.7 && intervals[i+1] > stats.mean * 1.3) {
        return 'premature';
      }
    }
    
    // Check for missed beat (extra long interval)
    for (let i = 0; i < intervals.length; i++) {
      if (intervals[i] > stats.mean * 1.8) {
        return 'missed';
      }
    }
    
    // Check for tachycardia (consistently short intervals)
    if (stats.mean < 600) { // 600ms = 100 BPM threshold
      return 'tachycardia';
    }
    
    // Check for bradycardia (consistently long intervals)
    if (stats.mean > 1000) { // 1000ms = 60 BPM threshold
      return 'bradycardia';
    }
    
    // Default to general irregularity
    return 'irregularity';
  }
  
  /**
   * Calculate HRV statistics from RR intervals
   */
  private calculateStatistics(intervals: number[]): { 
    mean: number, 
    std: number, 
    rmssd: number, 
    pnn50: number, 
    variation: number 
  } {
    if (intervals.length < 2) {
      return { mean: 0, std: 0, rmssd: 0, pnn50: 0, variation: 0 };
    }
    
    // Calculate mean
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // Calculate standard deviation
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const std = Math.sqrt(variance);
    
    // Calculate RMSSD (root mean square of successive differences)
    let sumSquaredDiff = 0;
    let nn50Count = 0;
    
    for (let i = 1; i < intervals.length; i++) {
      const diff = intervals[i] - intervals[i-1];
      sumSquaredDiff += diff * diff;
      
      if (Math.abs(diff) > 50) {
        nn50Count++;
      }
    }
    
    const rmssd = Math.sqrt(sumSquaredDiff / (intervals.length - 1));
    const pnn50 = intervals.length > 1 ? nn50Count / (intervals.length - 1) : 0;
    
    // Calculate relative variation
    const variation = mean > 0 ? std / mean : 0;
    
    return { mean, std, rmssd, pnn50, variation };
  }
  
  /**
   * Get the current arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
  
  /**
   * Reset the detector
   */
  public reset(): void {
    this.rrIntervals = [];
    this.lastDetectionTime = 0;
    this.arrhythmiaCount = 0;
    this.recentDetections = [];
  }
  
  /**
   * Cleanup TensorFlow resources
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
  
  /**
   * Get recent arrhythmia detections for trending
   */
  public getRecentDetections(): ArrhythmiaResult[] {
    return [...this.recentDetections];
  }
}

// Export types
export type { ArrhythmiaResult, ArrhythmiaDetectionConfig };
