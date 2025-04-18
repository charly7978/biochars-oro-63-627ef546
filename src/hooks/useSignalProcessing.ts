
/**
 * Custom hook for centralized signal processing
 * Provides optimized access to all signal channels
 */
import { useState, useEffect, useCallback } from 'react';
import { signalProcessingService, ProcessingMetrics } from '../core/signal-processing/SignalProcessingService';
import { ProcessedSignal } from '../types/signal';

export function useSignalProcessing() {
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [metrics, setMetrics] = useState<ProcessingMetrics>({
    fps: 0,
    quality: 0,
    fingerDetected: false,
    startTime: null,
    processedFrames: 0
  });
  
  // Set up subscriptions to service observables
  useEffect(() => {
    const signalSubscription = signalProcessingService.getSignalObservable()
      .subscribe(signal => {
        if (signal) {
          setLastSignal(signal);
        }
      });
      
    const metricsSubscription = signalProcessingService.getMetricsObservable()
      .subscribe(newMetrics => {
        setMetrics(newMetrics);
      });
    
    return () => {
      signalSubscription.unsubscribe();
      metricsSubscription.unsubscribe();
    };
  }, []);
  
  // Start processing
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessing: Starting signal processing");
    signalProcessingService.startProcessing();
  }, []);
  
  // Stop processing
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessing: Stopping signal processing");
    signalProcessingService.stopProcessing();
  }, []);
  
  // Process a frame
  const processFrame = useCallback((imageData: ImageData) => {
    return signalProcessingService.processFrame(imageData);
  }, []);
  
  // Manual signal processing (for testing or external sensors)
  const processSignal = useCallback((value: number, quality: number, isFingerDetected: boolean) => {
    return signalProcessingService.processSignal(value, quality, isFingerDetected);
  }, []);
  
  // Reset processing
  const reset = useCallback(() => {
    signalProcessingService.reset();
  }, []);
  
  // Get a specific channel data
  const getChannel = useCallback((name: string) => {
    return signalProcessingService.getChannel(name);
  }, []);
  
  // Get all channels data
  const getAllChannels = useCallback(() => {
    return signalProcessingService.getAllChannels();
  }, []);
  
  return {
    lastSignal,
    metrics,
    isProcessing: metrics.startTime !== null,
    startProcessing,
    stopProcessing,
    processFrame,
    processSignal,
    reset,
    getChannel,
    getAllChannels
  };
}
