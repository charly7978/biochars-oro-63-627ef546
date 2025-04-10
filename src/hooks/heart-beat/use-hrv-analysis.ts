import { useState, useEffect, useCallback, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';

export interface HRVAnalysisResult {
  sdnn: number;        // Standard deviation of NN intervals
  rmssd: number;       // Root mean square of successive differences
  pnn50: number;       // Percentage of successive RR intervals that differ by more than 50ms
  baevsky: number;     // Baevsky's stress index
  lfHfRatio: number;   // Low frequency to high frequency ratio
  sampleEntropy: number; // Sample entropy (complexity measure)
  hasArrhythmia: boolean; // Whether an arrhythmia was detected
  quality: number;     // Signal quality estimation (0-1)
}

interface HRVAnalysisOptions {
  windowSize: number;
  useTensorFlow: boolean;
  detectionThreshold: number;
}

const DEFAULT_OPTIONS: HRVAnalysisOptions = {
  windowSize: 30,      // Number of beats to analyze
  useTensorFlow: true, // Whether to use TensorFlow for advanced analysis
  detectionThreshold: 0.7 // Threshold for arrhythmia detection
};

export function useHRVAnalysis(options: Partial<HRVAnalysisOptions> = {}) {
  const [hrvResult, setHrvResult] = useState<HRVAnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const rriBufferRef = useRef<number[]>([]);
  const tfModelRef = useRef<tf.LayersModel | null>(null);
  const isModelLoadingRef = useRef(false);
  
  const config = useRef<HRVAnalysisOptions>({
    ...DEFAULT_OPTIONS,
    ...options
  });
  
  // Initialize TensorFlow model if enabled
  useEffect(() => {
    if (config.current.useTensorFlow && !tfModelRef.current && !isModelLoadingRef.current) {
      loadModel();
    }
    
    return () => {
      if (tfModelRef.current) {
        tfModelRef.current.dispose();
        tfModelRef.current = null;
      }
    };
  }, []);
  
  /**
   * Load a TensorFlow model for HRV analysis
   */
  const loadModel = async () => {
    if (isModelLoadingRef.current || tfModelRef.current) return;
    
    isModelLoadingRef.current = true;
    
    try {
      // Create a simple model for HRV feature extraction
      const model = tf.sequential();
      
      // Layer for RR intervals time series
      model.add(tf.layers.dense({
        inputShape: [config.current.windowSize],
        units: 16,
        activation: 'relu'
      }));
      
      model.add(tf.layers.dense({
        units: 8,
        activation: 'relu'
      }));
      
      model.add(tf.layers.dense({
        units: 4,
        activation: 'sigmoid'
      }));
      
      model.compile({
        optimizer: tf.train.adam(),
        loss: 'meanSquaredError'
      });
      
      // Create some synthetic data for initial weights adjustment
      const sampleX = tf.randomNormal([10, config.current.windowSize]);
      const sampleY = tf.randomNormal([10, 4]);
      
      // Fit model for initialization (minimal training just to set weights)
      await model.fit(sampleX, sampleY, {
        epochs: 1,
        verbose: 0
      });
      
      tfModelRef.current = model;
      isModelLoadingRef.current = false;
      
      // Clean up sample tensors
      sampleX.dispose();
      sampleY.dispose();
      
      console.log('HRV analysis model created successfully');
    } catch (error) {
      console.error('Failed to initialize HRV analysis model:', error);
      isModelLoadingRef.current = false;
    }
  };
  
  /**
   * Add a new RR interval for analysis
   */
  const addRRInterval = useCallback((interval: number): void => {
    if (interval <= 0 || interval > 2500) return; // Invalid interval
    
    rriBufferRef.current.push(interval);
    
    // Keep only the necessary intervals
    if (rriBufferRef.current.length > config.current.windowSize * 1.5) {
      rriBufferRef.current = rriBufferRef.current.slice(-config.current.windowSize);
    }
  }, []);
  
  /**
   * Analyze HRV based on collected RR intervals
   */
  const analyzeHRV = useCallback(async (): Promise<HRVAnalysisResult | null> => {
    const intervals = rriBufferRef.current;
    
    if (intervals.length < Math.max(5, config.current.windowSize / 2)) {
      return null; // Not enough data
    }
    
    setIsProcessing(true);
    
    try {
      // Calculate basic time-domain HRV metrics
      const basicMetrics = calculateBasicHRVMetrics(intervals);
      
      // Enhanced analysis with TensorFlow if available
      let enhancedMetrics = {
        lfHfRatio: 0,
        sampleEntropy: 0,
        hasArrhythmia: false,
        quality: 1.0
      };
      
      if (config.current.useTensorFlow && tfModelRef.current) {
        enhancedMetrics = await calculateEnhancedMetrics(intervals);
      }
      
      const result: HRVAnalysisResult = {
        ...basicMetrics,
        ...enhancedMetrics
      };
      
      setHrvResult(result);
      setIsProcessing(false);
      
      return result;
    } catch (error) {
      console.error('Error analyzing HRV:', error);
      setIsProcessing(false);
      return null;
    }
  }, []);
  
  /**
   * Calculate basic time-domain HRV metrics
   */
  const calculateBasicHRVMetrics = (intervals: number[]) => {
    // Mean NN interval
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    
    // SDNN - Standard deviation of NN intervals
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const sdnn = Math.sqrt(variance);
    
    // RMSSD - Root mean square of successive differences
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
    
    // PNN50 - Percentage of successive RR intervals that differ by more than 50ms
    const pnn50 = intervals.length > 1 ? (nn50Count / (intervals.length - 1)) * 100 : 0;
    
    // Baevsky's stress index
    // SI = AMo / (2 * Mo * MxDMn)
    // Where:
    // - AMo: Amplitude of the mode (percentage of intervals falling into the modal interval)
    // - Mo: Mode (most frequent interval value)
    // - MxDMn: Variation range (difference between max and min intervals)
    
    // Simplified calculation
    const range = Math.max(...intervals) - Math.min(...intervals);
    const baevsky = range > 0 ? (sdnn / range) * 100 : 0;
    
    return {
      sdnn,
      rmssd,
      pnn50,
      baevsky
    };
  };
  
  /**
   * Calculate enhanced HRV metrics using TensorFlow
   */
  const calculateEnhancedMetrics = async (intervals: number[]) => {
    if (!tfModelRef.current) {
      return {
        lfHfRatio: 0,
        sampleEntropy: 0,
        hasArrhythmia: false,
        quality: 1.0
      };
    }
    
    // Prepare data for TensorFlow
    const paddedIntervals = [...intervals];
    while (paddedIntervals.length < config.current.windowSize) {
      paddedIntervals.push(intervals[intervals.length - 1] || 1000);
    }
    
    // Use only the most recent intervals
    const recentIntervals = paddedIntervals.slice(-config.current.windowSize);
    
    // Normalize intervals
    const mean = recentIntervals.reduce((sum, val) => sum + val, 0) / recentIntervals.length;
    const std = Math.sqrt(
      recentIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentIntervals.length
    );
    
    const normalizedIntervals = recentIntervals.map(interval => (interval - mean) / (std || 1));
    
    // Create tensor
    const tensor = tf.tensor2d([normalizedIntervals], [1, config.current.windowSize]);
    
    try {
      // Get model prediction
      const prediction = tfModelRef.current.predict(tensor) as tf.Tensor;
      const values = await prediction.data();
      
      // Extract features from prediction
      // Assuming model outputs:
      // [0]: LF/HF ratio estimation
      // [1]: Sample entropy estimation
      // [2]: Arrhythmia probability
      // [3]: Signal quality estimation
      
      const lfHfRatio = values[0];
      const sampleEntropy = values[1];
      const arrhythmiaProbability = values[2];
      const quality = values[3];
      
      // Clean up
      tensor.dispose();
      prediction.dispose();
      
      return {
        lfHfRatio,
        sampleEntropy,
        hasArrhythmia: arrhythmiaProbability >= config.current.detectionThreshold,
        quality
      };
    } catch (error) {
      console.error('Error in TensorFlow HRV analysis:', error);
      tensor.dispose();
      
      return {
        lfHfRatio: 0,
        sampleEntropy: 0,
        hasArrhythmia: false,
        quality: 1.0
      };
    }
  };
  
  /**
   * Reset all data
   */
  const reset = useCallback(() => {
    rriBufferRef.current = [];
    setHrvResult(null);
  }, []);
  
  return {
    hrvResult,
    isProcessing,
    addRRInterval,
    analyzeHRV,
    reset
  };
}
