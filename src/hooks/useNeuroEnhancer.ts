
/**
 * Hook for using the NeuroEnhancer
 * Integrates the neural enhancement capabilities into React components
 */
import { useState, useEffect, useCallback } from 'react';
import { neuroEnhancer, EnhancementOptions, EnhancementResult } from '../modules/ai/NeuroEnhancer';
import { tensorflowService } from '../modules/ai/tensorflow-service';

export function useNeuroEnhancer(initialOptions?: EnhancementOptions) {
  const [isReady, setIsReady] = useState<boolean>(false);
  const [options, setOptions] = useState<EnhancementOptions>(initialOptions || {});
  const [lastResult, setLastResult] = useState<EnhancementResult | null>(null);
  const [metrics, setMetrics] = useState(neuroEnhancer.getMetrics());
  const [isWebGPUAvailable, setIsWebGPUAvailable] = useState<boolean>(false);
  
  // Initialize on mount
  useEffect(() => {
    const checkReadiness = async () => {
      // Update WebGPU availability
      setIsWebGPUAvailable(tensorflowService.isWebGPUAvailable());
      
      // Check enhancer readiness
      const ready = neuroEnhancer.isReady();
      setIsReady(ready);
      
      if (!ready) {
        // If not ready, check again in 1 second
        setTimeout(checkReadiness, 1000);
      }
    };
    
    // Start checking
    checkReadiness();
    
    // Update metrics periodically
    const metricsInterval = setInterval(() => {
      setMetrics(neuroEnhancer.getMetrics());
    }, 5000);
    
    return () => {
      clearInterval(metricsInterval);
    };
  }, []);
  
  // Update options when they change
  useEffect(() => {
    neuroEnhancer.updateOptions(options);
  }, [options]);
  
  // Method to enhance a signal
  const enhanceSignal = useCallback(async (signal: number[]): Promise<EnhancementResult> => {
    try {
      const result = await neuroEnhancer.enhanceSignal(signal);
      setLastResult(result);
      return result;
    } catch (error) {
      console.error("Error enhancing signal:", error);
      
      // Return original signal with low confidence on error
      const errorResult: EnhancementResult = {
        enhancedSignal: [...signal],
        qualityImprovement: 0,
        confidenceScore: 0.1,
        latency: 0
      };
      
      setLastResult(errorResult);
      return errorResult;
    }
  }, []);
  
  // Method to update options
  const updateOptions = useCallback((newOptions: Partial<EnhancementOptions>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
    neuroEnhancer.updateOptions(newOptions);
  }, []);
  
  // Get TensorFlow info
  const getTensorFlowInfo = useCallback(() => {
    return tensorflowService.getTensorFlowInfo();
  }, []);
  
  return {
    isReady,
    enhanceSignal,
    lastResult,
    metrics,
    updateOptions,
    options,
    isWebGPUAvailable,
    getTensorFlowInfo
  };
}
