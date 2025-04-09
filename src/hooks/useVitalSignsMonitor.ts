import { useState, useEffect, useCallback, useRef } from 'react';
import { container } from '../core/di/service-container';
import { initializeTensorFlow, getTensorFlowInfo } from '../core/ml/tensorflow-initializer';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../core/config/ProcessorConfig';
import { useUnifiedSignalProcessor } from './useUnifiedSignalProcessor';
import { FeedbackSystem } from '../core/feedback/feedback-system';
import { CalibrationManager, CalibrationState } from '../core/calibration/calibration-manager';
import { FrameBufferManager } from '../core/signal/frame-buffer-manager';

export interface VitalSignsResult {
  heartRate: {
    bpm: number;
    confidence: number;
  };
  spo2: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
    map?: number;
  };
  arrhythmiaStatus: string;
  arrhythmiaCount: number;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  processingTime?: number;
}

export interface VitalSignsMonitorReturn {
  isInitialized: boolean;
  isMonitoring: boolean;
  lastResult: VitalSignsResult | null;
  processSignal: (value: number) => void;
  processFrame: (imageData: ImageData) => void;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  startCalibration: () => void;
  calibrationState: CalibrationState | null;
  reset: () => void;
  error: Error | null;
  stats: {
    avgProcessingTime: number;
    arrhythmiaWindows: Array<{start: number, end: number}>;
    signalQuality: number;
    bufferFullness: number;
    backendInfo: {
      usingTensorFlow: boolean;
      backend: string;
      webGPUAvailable: boolean;
    };
  };
}

/**
 * Unified hook for vital signs monitoring
 * Integrates TensorFlow.js, WebWorker processing, and intelligent calibration
 */
export const useVitalSignsMonitor = (config?: Partial<ProcessorConfig>): VitalSignsMonitorReturn => {
  // Component state
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastResult, setLastResult] = useState<VitalSignsResult | null>(null);
  const [calibrationState, setCalibrationState] = useState<CalibrationState | null>(null);
  const [stats, setStats] = useState({
    avgProcessingTime: 0,
    arrhythmiaWindows: [] as Array<{start: number, end: number}>,
    signalQuality: 0,
    bufferFullness: 0,
    backendInfo: {
      usingTensorFlow: false,
      backend: 'none',
      webGPUAvailable: false
    }
  });
  
  // References
  const processorRef = useRef<ReturnType<typeof useUnifiedSignalProcessor> | null>(null);
  const calibrationManagerRef = useRef<CalibrationManager | null>(null);
  const frameBufferRef = useRef<FrameBufferManager | null>(null);
  const feedbackSystemRef = useRef<FeedbackSystem | null>(null);
  const arrhythmiaWindowsRef = useRef<Array<{start: number, end: number}>>([]);
  const configRef = useRef<ProcessorConfig>({
    ...DEFAULT_PROCESSOR_CONFIG,
    ...config
  });
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Get processor from unified hook
  const {
    isInitialized: processorInitialized,
    isProcessing,
    lastResult: processorResult,
    processSignal: internalProcessSignal,
    processFrame: internalProcessFrame,
    startCalibration: internalStartCalibration,
    reset: internalReset,
    updateConfig,
    error: processorError,
    stats: processorStats
  } = useUnifiedSignalProcessor(configRef.current);
  
  // Store processor reference
  useEffect(() => {
    processorRef.current = {
      isInitialized: processorInitialized,
      isProcessing,
      lastResult: processorResult,
      processSignal: internalProcessSignal,
      processFrame: internalProcessFrame,
      startCalibration: internalStartCalibration,
      reset: internalReset,
      updateConfig,
      error: processorError,
      stats: processorStats
    };
  }, [
    processorInitialized,
    isProcessing,
    processorResult,
    internalProcessSignal,
    internalProcessFrame,
    internalStartCalibration,
    internalReset,
    updateConfig,
    processorError,
    processorStats
  ]);
  
  /**
   * Initialize the monitoring system
   */
  const initialize = useCallback(async () => {
    try {
      console.log('Initializing vital signs monitoring system');
      
      // Register config in container
      container.register('processorConfig', configRef.current);
      
      // Initialize TensorFlow.js
      const tfInitialized = await initializeTensorFlow(configRef.current);
      
      // Create calibration manager
      calibrationManagerRef.current = new CalibrationManager({
        minCalibrationTime: 5000,
        maxCalibrationTime: configRef.current.calibration.durationMs,
        targetSamples: configRef.current.calibration.requiredSamples,
        qualityThreshold: 70,
        adaptiveMode: true
      });
      
      // Set calibration update callback
      if (calibrationManagerRef.current) {
        calibrationManagerRef.current.setUpdateCallback((state) => {
          setCalibrationState(state);
        });
      }
      
      // Create frame buffer manager
      frameBufferRef.current = new FrameBufferManager({
        maxBufferSize: 60,
        processingInterval: 33, // ~30fps
        interpolationFactor: 0.3
      });
      
      // Set frame buffer processing callback
      if (frameBufferRef.current && processorRef.current) {
        frameBufferRef.current.setProcessingCallback((value) => {
          if (processorRef.current) {
            processorRef.current.processSignal(value);
          }
        });
      }
      
      // Create feedback system
      feedbackSystemRef.current = new FeedbackSystem();
      
      // Register services in container
      container.register('calibrationManager', calibrationManagerRef.current);
      container.register('frameBufferManager', frameBufferRef.current);
      container.register('feedbackSystem', feedbackSystemRef.current);
      
      // Get TensorFlow info
      const tfInfo = getTensorFlowInfo();
      
      // Update stats
      setStats(prev => ({
        ...prev,
        backendInfo: {
          usingTensorFlow: tfInitialized,
          backend: tfInfo.backend,
          webGPUAvailable: tfInfo.isWebGPU
        }
      }));
      
      setIsInitialized(true);
      setError(null);
      
      console.log('Vital signs monitoring system initialized successfully', {
        tensorflow: tfInfo,
        sessionId: sessionId.current
      });
      
      return true;
    } catch (err) {
      console.error('Failed to initialize vital signs monitoring system:', err);
      setError(err instanceof Error ? err : new Error('Failed to initialize'));
      return false;
    }
  }, []);
  
  // Initialize on mount
  useEffect(() => {
    initialize();
    
    return () => {
      // Cleanup
      if (frameBufferRef.current) {
        frameBufferRef.current.stop();
      }
    };
  }, [initialize]);
  
  // Update state when processor result changes
  useEffect(() => {
    if (processorResult && isMonitoring) {
      // Convert processor result to vital signs result
      const vitalResult: VitalSignsResult = {
        heartRate: processorResult.heartRate || { bpm: 0, confidence: 0 },
        spo2: processorResult.spo2 || 0,
        bloodPressure: processorResult.bloodPressure || { systolic: 0, diastolic: 0 },
        arrhythmiaStatus: processorResult.arrhythmia ? 'ARRHYTHMIA DETECTED' : '--',
        arrhythmiaCount: 0, // Will be updated from arrhythmia count
        glucose: 0, // Will add glucose processing
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        processingTime: processorResult.processingTime
      };
      
      // If arrhythmia detected, create a window
      if (processorResult.arrhythmia) {
        const now = Date.now();
        arrhythmiaWindowsRef.current.push({
          start: now - 400,
          end: now + 400
        });
        
        // Keep only last 5 windows
        if (arrhythmiaWindowsRef.current.length > 5) {
          arrhythmiaWindowsRef.current.shift();
        }
        
        // Update count
        vitalResult.arrhythmiaCount = arrhythmiaWindowsRef.current.length;
      }
      
      // Update calibration if in progress
      if (calibrationManagerRef.current?.isCalibrating() && processorResult.filtered !== undefined) {
        calibrationManagerRef.current.processSample(
          processorResult.filtered,
          processorResult.heartRate?.confidence || 0
        );
      }
      
      // Update stats
      setStats(prev => ({
        ...prev,
        avgProcessingTime: processorResult.processingTime || 0,
        arrhythmiaWindows: [...arrhythmiaWindowsRef.current],
        signalQuality: processorResult.heartRate?.confidence || 0,
        bufferFullness: processorStats.bufferFullness
      }));
      
      setLastResult(vitalResult);
    }
  }, [processorResult, isMonitoring, processorStats.bufferFullness]);
  
  // Update error state when processor error changes
  useEffect(() => {
    if (processorError) {
      setError(processorError);
    }
  }, [processorError]);
  
  /**
   * Process a single PPG signal value
   */
  const processSignal = useCallback((value: number) => {
    if (!isInitialized || !isMonitoring) {
      return;
    }
    
    try {
      // Add to frame buffer for smooth processing
      if (frameBufferRef.current) {
        frameBufferRef.current.addFrame(value);
      } else {
        // Fallback if frame buffer not available
        if (processorRef.current) {
          processorRef.current.processSignal(value);
        }
      }
    } catch (err) {
      console.error('Error processing signal:', err);
      setError(err instanceof Error ? err : new Error('Error processing signal'));
    }
  }, [isInitialized, isMonitoring]);
  
  /**
   * Process an image frame
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (!isInitialized || !isMonitoring || !processorRef.current) {
      return;
    }
    
    try {
      processorRef.current.processFrame(imageData);
    } catch (err) {
      console.error('Error processing frame:', err);
      setError(err instanceof Error ? err : new Error('Error processing frame'));
    }
  }, [isInitialized, isMonitoring]);
  
  /**
   * Start monitoring vital signs
   */
  const startMonitoring = useCallback(() => {
    if (!isInitialized) {
      initialize().then(success => {
        if (success) {
          setIsMonitoring(true);
          console.log('Vital signs monitoring started');
          
          // Add feedback
          if (feedbackSystemRef.current) {
            feedbackSystemRef.current.addFeedback(
              'Place your finger on the camera',
              'info'
            );
          }
        }
      });
    } else {
      setIsMonitoring(true);
      console.log('Vital signs monitoring started');
      
      // Add feedback
      if (feedbackSystemRef.current) {
        feedbackSystemRef.current.addFeedback(
          'Place your finger on the camera',
          'info'
        );
      }
    }
  }, [isInitialized, initialize]);
  
  /**
   * Stop monitoring vital signs
   */
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    console.log('Vital signs monitoring stopped');
    
    // Add feedback
    if (feedbackSystemRef.current) {
      feedbackSystemRef.current.addFeedback(
        'Monitoring stopped',
        'info'
      );
    }
  }, []);
  
  /**
   * Start calibration process
   */
  const startCalibration = useCallback(() => {
    if (!isInitialized) {
      return;
    }
    
    // Start calibration in the processor
    if (processorRef.current) {
      processorRef.current.startCalibration();
    }
    
    // Start calibration in the calibration manager
    if (calibrationManagerRef.current) {
      calibrationManagerRef.current.startCalibration();
    }
    
    // Add feedback
    if (feedbackSystemRef.current) {
      feedbackSystemRef.current.addFeedback(
        'Calibration started - please keep your finger steady',
        'info'
      );
    }
    
    console.log('Calibration started');
  }, [isInitialized]);
  
  /**
   * Reset the monitoring system
   */
  const reset = useCallback(() => {
    // Reset processor
    if (processorRef.current) {
      processorRef.current.reset();
    }
    
    // Reset calibration manager
    if (calibrationManagerRef.current) {
      calibrationManagerRef.current.reset();
    }
    
    // Reset frame buffer
    if (frameBufferRef.current) {
      frameBufferRef.current.stop();
    }
    
    // Reset feedback system
    if (feedbackSystemRef.current) {
      feedbackSystemRef.current.reset();
    }
    
    // Reset state
    setLastResult(null);
    setCalibrationState(null);
    arrhythmiaWindowsRef.current = [];
    
    // Update stats
    setStats(prev => ({
      ...prev,
      arrhythmiaWindows: [],
      signalQuality: 0,
      bufferFullness: 0
    }));
    
    console.log('Vital signs monitoring system reset');
  }, []);
  
  return {
    isInitialized,
    isMonitoring,
    lastResult,
    processSignal,
    processFrame,
    startMonitoring,
    stopMonitoring,
    startCalibration,
    calibrationState,
    reset,
    error,
    stats
  };
};
