
/**
 * Hook for using optimized signal processing
 * Connects the signal core processor with the optimization system
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { SignalCoreProcessor } from '../core/signal-processing/SignalCoreProcessor';
import { OptimizationController } from '../core/optimization/OptimizationController';
import { VitalSignsResult } from '../modules/vital-signs/types/vital-signs-result';

export function useOptimizedSignals() {
  const processorRef = useRef<SignalCoreProcessor | null>(null);
  const optimizerRef = useRef<OptimizationController | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResults, setLastResults] = useState<VitalSignsResult | null>(null);
  const [optimizationStats, setOptimizationStats] = useState<Record<string, any>>({});
  const [signalQuality, setSignalQuality] = useState<number>(0);
  
  // Initialize the processors
  useEffect(() => {
    processorRef.current = new SignalCoreProcessor({
      bufferSize: 300,
      sampleRate: 30,
      channels: [
        'heartRate',
        'spo2',
        'bloodPressure',
        'glucose',
        'lipids',
        'hemoglobin',
        'hydration',
        'arrhythmia'
      ]
    });
    
    optimizerRef.current = new OptimizationController();
    
    return () => {
      processorRef.current = null;
      optimizerRef.current = null;
    };
  }, []);
  
  /**
   * Process a PPG value with optimization
   */
  const processValue = useCallback((value: number) => {
    if (!isProcessing || !processorRef.current || !optimizerRef.current) return null;
    
    try {
      // Process the raw signal
      const channels = processorRef.current.processSignal(value);
      
      // Apply optimization to each channel
      for (const [name, channel] of channels.entries()) {
        optimizerRef.current.optimizeChannel(channel);
      }
      
      // Get heartbeat channel for quality
      const heartbeatChannel = channels.get('heartbeat');
      if (heartbeatChannel) {
        const quality = heartbeatChannel.getLastMetadata()?.quality || 0;
        setSignalQuality(quality);
      }
      
      return {
        channels,
        quality: signalQuality,
        value
      };
    } catch (error) {
      console.error("useOptimizedSignals: Error processing value", error);
      return null;
    }
  }, [isProcessing, signalQuality]);
  
  /**
   * Start processing with optimization
   */
  const startProcessing = useCallback(() => {
    console.log("useOptimizedSignals: Starting optimized signal processing");
    setIsProcessing(true);
  }, []);
  
  /**
   * Stop processing
   */
  const stopProcessing = useCallback(() => {
    console.log("useOptimizedSignals: Stopping optimized signal processing");
    setIsProcessing(false);
  }, []);
  
  /**
   * Provide measurement results for feedback
   */
  const provideResults = useCallback((results: VitalSignsResult) => {
    if (!optimizerRef.current) return;
    
    // Process the new results
    optimizerRef.current.processResults(results, lastResults || undefined);
    
    // Update last results
    setLastResults(results);
    
    // Update optimization statistics
    const stats: Record<string, any> = {};
    
    ['heartRate', 'spo2', 'bloodPressure', 'glucose', 'lipids', 'hemoglobin', 'hydration'].forEach(channel => {
      stats[channel] = optimizerRef.current?.getOptimizationStats(channel);
    });
    
    setOptimizationStats(stats);
  }, [lastResults]);
  
  /**
   * Get a specific channel
   */
  const getChannel = useCallback((channelName: string) => {
    return processorRef.current?.getChannel(channelName);
  }, []);
  
  /**
   * Reset the processors
   */
  const reset = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.reset();
    }
    
    if (optimizerRef.current) {
      optimizerRef.current.reset();
    }
    
    setLastResults(null);
    setOptimizationStats({});
    setSignalQuality(0);
  }, []);
  
  return {
    processValue,
    startProcessing,
    stopProcessing,
    provideResults,
    getChannel,
    reset,
    isProcessing,
    signalQuality,
    optimizationStats
  };
}
