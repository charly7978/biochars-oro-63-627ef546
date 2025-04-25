
/**
 * Central Signal Processing Hook - provides access to the core signal processor
 * Fase 3 y 4: Solo datos reales, sin manipulaciones
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { createSignalProcessor, SignalChannel } from '../core/signal-processing';

export interface SignalCoreResult {
  channels: Map<string, SignalChannel>;
  lastValue: number | null;
  quality: number;
  isProcessing: boolean;
  processingStats: {
    processedFrames: number;
    startTime: number | null;
    fps: number;
  };
}

export function useSignalCore(options = {}) {
  // Create processor instance
  const processorRef = useRef(createSignalProcessor());
  const [isProcessing, setIsProcessing] = useState(false);
  const processingStatsRef = useRef({
    processedFrames: 0,
    startTime: null as number | null,
    lastUpdateTime: 0,
    fps: 0
  });
  
  // Track core signal state
  const [signalState, setSignalState] = useState<SignalCoreResult>({
    channels: new Map(),
    lastValue: null,
    quality: 0,
    isProcessing: false,
    processingStats: {
      processedFrames: 0,
      startTime: null,
      fps: 0
    }
  });

  /**
   * Start signal processing
   */
  const startProcessing = useCallback(() => {
    console.log("SignalCore: Starting processing");
    processingStatsRef.current = {
      processedFrames: 0,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      fps: 0
    };
    setIsProcessing(true);
  }, []);

  /**
   * Stop signal processing
   */
  const stopProcessing = useCallback(() => {
    console.log("SignalCore: Stopping processing");
    setIsProcessing(false);
    processingStatsRef.current.startTime = null;
  }, []);

  /**
   * Process a raw PPG value - Fase 3: Implementar paso directo
   */
  const processValue = useCallback((value: number) => {
    if (!isProcessing) return null;
    
    try {
      // Update processing stats
      processingStatsRef.current.processedFrames++;
      const now = Date.now();
      
      // Update FPS calculation every second
      if (now - processingStatsRef.current.lastUpdateTime > 1000) {
        const elapsed = now - processingStatsRef.current.lastUpdateTime;
        const framesDelta = processingStatsRef.current.processedFrames;
        // Calcular FPS sin funciones Math
        processingStatsRef.current.fps = (framesDelta / elapsed) * 1000;
        processingStatsRef.current.lastUpdateTime = now;
        processingStatsRef.current.processedFrames = 0;
      }
      
      // Process the value directly
      const channels = processorRef.current.processSignal(value);
      
      // Get heartbeat channel for quality
      const heartbeatChannel = channels.get('heartbeat');
      const quality = heartbeatChannel?.getLastMetadata()?.quality || 0;
      
      // Update state (limit updates to reduce render overhead)
      if (processingStatsRef.current.processedFrames % 3 === 0) {
        setSignalState({
          channels: new Map(channels),
          lastValue: value,
          quality,
          isProcessing,
          processingStats: {
            processedFrames: processingStatsRef.current.processedFrames,
            startTime: processingStatsRef.current.startTime,
            fps: processingStatsRef.current.fps
          }
        });
      }
      
      return {
        channels,
        quality,
        lastValue: value
      };
    } catch (error) {
      console.error("SignalCore: Error processing value", error);
      return null;
    }
  }, [isProcessing]);

  /**
   * Process a frame from camera - Fase 3: Pasar datos directos sin manipulación
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (!isProcessing) return null;
    
    try {
      // Extract red channel average (simplified)
      const data = imageData.data;
      let redSum = 0;
      let count = 0;
      
      // Sample center region for better results
      const width = imageData.width;
      const height = imageData.height;
      const startX = ~~(width * 0.3);
      const endX = ~~(width * 0.7);
      const startY = ~~(height * 0.3);
      const endY = ~~(height * 0.7);
      
      for (let y = startY; y < endY; y += 2) { // Skip pixels for performance
        for (let x = startX; x < endX; x += 2) {
          const i = (y * width + x) * 4;
          redSum += data[i]; // Red channel
          count++;
        }
      }
      
      const redAvg = redSum / count;
      
      // Process the value directly
      return processValue(redAvg);
    } catch (error) {
      console.error("SignalCore: Error processing frame", error);
      return null;
    }
  }, [isProcessing, processValue]);

  /**
   * Reset all processing state
   */
  const reset = useCallback(() => {
    processorRef.current.reset();
    processingStatsRef.current = {
      processedFrames: 0,
      startTime: null,
      lastUpdateTime: 0,
      fps: 0
    };
    setSignalState({
      channels: new Map(),
      lastValue: null,
      quality: 0,
      isProcessing: false,
      processingStats: {
        processedFrames: 0,
        startTime: null,
        fps: 0
      }
    });
    console.log("SignalCore: Reset complete");
  }, []);

  /**
   * Get a specific channel by name
   */
  const getChannel = useCallback((channelName: string): SignalChannel | undefined => {
    return processorRef.current.getChannel(channelName);
  }, []);

  return {
    signalState,
    startProcessing,
    stopProcessing,
    processValue,
    processFrame,
    reset,
    getChannel,
    isProcessing
  };
}
