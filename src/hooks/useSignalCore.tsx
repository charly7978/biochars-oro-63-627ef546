/**
 * Central Signal Processing Hook - provides access to the core signal processor
 * with dedicated channels for each vital sign and bidirectional feedback
 */
import React, { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react';
import { createSignalProcessor, SignalChannel } from '../core/signal-processing';
import { VITAL_SIGN_CHANNELS } from '../core/signal-processing/SignalCoreProcessor';
import { VitalSignIntegrator } from '../core/integration/VitalSignIntegrator';
// ... resto del código del hook useSignalCore ...

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
  // Create processor instance with dedicated channels
  const processorRef = useRef(createSignalProcessor({
    bufferSize: 300,
    sampleRate: 30,
    channels: Object.values(VITAL_SIGN_CHANNELS)
  }));
  
  // Initialize the VitalSignIntegrator
  const integratorRef = useRef<VitalSignIntegrator | null>(null);
  
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

  // Initialize the VitalSignIntegrator
  useEffect(() => {
    integratorRef.current = VitalSignIntegrator.getInstance(processorRef.current);
    
    return () => {
      // Clean up when unmounting
      if (integratorRef.current) {
        integratorRef.current.dispose();
      }
    };
  }, []);

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
   * Process a raw PPG value
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
        processingStatsRef.current.fps = (framesDelta / elapsed) * 1000;
        processingStatsRef.current.lastUpdateTime = now;
        processingStatsRef.current.processedFrames = 0;
      }
      
      // First add to RAW channel directly
      const rawChannel = processorRef.current.getChannel(VITAL_SIGN_CHANNELS.RAW);
      if (rawChannel) {
        rawChannel.addValue(value, {
          quality: 100,
          timestamp: now
        });
      } else {
        // Process through traditional method if RAW channel doesn't exist
        processorRef.current.processSignal(value);
      }
      
      // Get all channels using the public method
      const channels = processorRef.current.getChannels();
      
      // Get heartbeat channel for quality
      const heartbeatChannel = channels.get(VITAL_SIGN_CHANNELS.HEARTBEAT);
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
   * Process a frame from camera
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (!isProcessing) return null;
    
    try {
      // Extract red channel average (simplified)
      const data = imageData.data;
      let redSum = 0;
      let count = 0;
      
      // Sample center region for better results
      const startX = Math.floor(imageData.width * 0.3);
      const endX = Math.floor(imageData.width * 0.7);
      const startY = Math.floor(imageData.height * 0.3);
      const endY = Math.floor(imageData.height * 0.7);
      
      for (let y = startY; y < endY; y += 2) { // Skip pixels for performance
        for (let x = startX; x < endX; x += 2) {
          const i = (y * imageData.width + x) * 4;
          redSum += data[i]; // Red channel
          count++;
        }
      }
      
      const redAvg = redSum / count;
      
      // Process the value
      return processValue(redAvg);
    } catch (error) {
      console.error("SignalCore: Error processing frame", error);
      return null;
    }
  }, [isProcessing, processValue]);

  /**
   * Register processor metrics for bidirectional feedback
   */
  const registerProcessorMetrics = useCallback((processorName: string, metrics: any) => {
    if (integratorRef.current) {
      integratorRef.current.registerProcessorMetrics(processorName, metrics);
    }
  }, []);

  /**
   * Subscribe to a vital sign channel
   */
  const subscribeToVitalSign = useCallback((vitalSign: string, callback: (value: number, metadata: any) => void) => {
    if (integratorRef.current) {
      return integratorRef.current.subscribeToVitalSign(vitalSign, callback);
    }
    return () => {}; // No-op unsubscribe
  }, []);

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

  /**
   * Get data from a vital sign channel
   */
  const getVitalSignData = useCallback((vitalSign: string) => {
    if (integratorRef.current) {
      return integratorRef.current.getVitalSignData(vitalSign);
    }
    return {
      values: [],
      latestValue: null,
      metadata: {}
    };
  }, []);

  return {
    signalState,
    startProcessing,
    stopProcessing,
    processValue,
    processFrame,
    reset,
    getChannel,
    isProcessing,
    registerProcessorMetrics,
    subscribeToVitalSign,
    getVitalSignData,
    VITAL_SIGN_CHANNELS
  };
}

// Crear el contexto
export const SignalCoreContext = createContext<ReturnType<typeof useSignalCore> | null>(null);

// Provider que inicializa el hook y expone el valor
export function SignalCoreProvider({ children }: { children: React.ReactNode }) {
  const signalCore = useSignalCore();
  return (
    <SignalCoreContext.Provider value={signalCore}>
      {children}
    </SignalCoreContext.Provider>
  );
}

// Hook para consumir el contexto
export function useSignalCoreContext() {
  const ctx = useContext(SignalCoreContext);
  if (!ctx) throw new Error('useSignalCoreContext debe usarse dentro de <SignalCoreProvider>');
  return ctx;
} 