/**
 * Hook for processing vital signs signals with hybrid processing
 * Combines traditional algorithms with neural networks
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  HybridVitalSignsProcessor,
  HybridProcessingOptions,
  VitalSignsResult 
} from '../modules/vital-signs';
import type { RRIntervalData } from '../types/vital-signs';
import type { ArrhythmiaWindow } from './vital-signs/types';
import { getDiagnosticsData, clearDiagnosticsData } from '../hooks/heart-beat/signal-processing/peak-detection';
import { tensorflowService } from '../modules/ai/tensorflow-service';

// Interface for diagnostics info
interface DiagnosticsInfo {
  processedSignals: number;
  signalLog: Array<{ timestamp: number, value: number, result: any, neuralUsed: boolean }>;
  performanceMetrics: {
    avgProcessTime: number;
    traditionalPercentage: number;
    neuralPercentage: number;
    hybridPercentage: number;
    avgConfidence: number;
  };
  neuralInfo: {
    modelsLoaded: string[];
    backend: string;
    webgpuEnabled: boolean;
  };
}

export function useHybridVitalSignsProcessor(initialOptions?: Partial<HybridProcessingOptions>) {
  const processorRef = useRef<HybridVitalSignsProcessor | null>(null);
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const [arrhythmiaWindows, setArrhythmiaWindows] = useState<ArrhythmiaWindow[]>([]);
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState<boolean>(true);
  const [neuralEnabled, setNeuralEnabled] = useState<boolean>(initialOptions?.useNeuralModels ?? true);
  
  // State for enhanced diagnostics
  const debugInfo = useRef<DiagnosticsInfo>({
    processedSignals: 0,
    signalLog: [],
    performanceMetrics: {
      avgProcessTime: 0,
      traditionalPercentage: 0,
      neuralPercentage: 0,
      hybridPercentage: 0,
      avgConfidence: 0
    },
    neuralInfo: {
      modelsLoaded: [],
      backend: '',
      webgpuEnabled: false
    }
  });
  
  // Initialize processor on mount
  const initializeProcessor = useCallback(() => {
    const options: Partial<HybridProcessingOptions> = {
      ...initialOptions,
      useNeuralModels: neuralEnabled
    };
    
    processorRef.current = new HybridVitalSignsProcessor(options);
    
    console.log("HybridVitalSignsProcessor initialized with options:", options);
    
    // Update neural info
    const tfInfo = tensorflowService.getTensorFlowInfo();
    debugInfo.current.neuralInfo = {
      modelsLoaded: tfInfo.modelsLoaded,
      backend: tfInfo.backend,
      webgpuEnabled: tfInfo.webgpuEnabled
    };
  }, [initialOptions, neuralEnabled]);

  // Initialization effect
  useEffect(() => {
    if (!processorRef.current) {
      initializeProcessor();
    }
    
    // Cleanup on unmount
    return () => {
      if (processorRef.current) {
        console.log("HybridVitalSignsProcessor cleanup");
        processorRef.current = null;
        clearDiagnosticsData(); // Clear diagnostics data
      }
    };
  }, [initializeProcessor]);
  
  // Update neural processing when toggled
  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.setNeuralProcessing(neuralEnabled);
    }
  }, [neuralEnabled]);
  
  // Update performance metrics periodically
  useEffect(() => {
    if (!diagnosticsEnabled) return;
    
    const updateInterval = setInterval(() => {
      // Get diagnostics data from peak detection module
      const peakDiagnostics = getDiagnosticsData();
      
      if (peakDiagnostics.length > 0) {
        // Calculate performance metrics
        const totalTime = peakDiagnostics.reduce((sum, data) => sum + data.processTime, 0);
        
        // Update neural info
        const tfInfo = tensorflowService.getTensorFlowInfo();
        debugInfo.current.neuralInfo = {
          modelsLoaded: tfInfo.modelsLoaded,
          backend: tfInfo.backend,
          webgpuEnabled: tfInfo.webgpuEnabled
        };
        
        // Update metrics
        if (debugInfo.current.signalLog.length > 0) {
          const neuralCount = debugInfo.current.signalLog.filter(log => log.neuralUsed).length;
          const totalSignals = debugInfo.current.signalLog.length;
          
          debugInfo.current.performanceMetrics = {
            avgProcessTime: totalTime / peakDiagnostics.length,
            neuralPercentage: (neuralCount / totalSignals) * 100,
            traditionalPercentage: ((totalSignals - neuralCount) / totalSignals) * 100,
            hybridPercentage: (debugInfo.current.signalLog.filter(log => 
              log.neuralUsed && log.result?.confidence?.overall > 0.7
            ).length / totalSignals) * 100,
            avgConfidence: debugInfo.current.signalLog.reduce((sum, log) => 
              sum + (log.result?.confidence?.overall || 0), 0) / totalSignals
          };
        }
      }
    }, 5000); // Update every 5 seconds
    
    return () => clearInterval(updateInterval);
  }, [diagnosticsEnabled]);
  
  // Process signal data
  const processSignal = useCallback(async (
    value: number, 
    rrData?: RRIntervalData
  ): Promise<VitalSignsResult> => {
    if (!processorRef.current) {
      console.warn("HybridVitalSignsProcessor not initialized");
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        }
      };
    }
    
    // Increment processed signals counter
    debugInfo.current.processedSignals++;
    
    // Measure processing time
    const startTime = performance.now();
    
    // Process signal
    const result = await processorRef.current.processSignal({
      value,
      rrData
    });
    
    // Calculate processing time
    const processingTime = performance.now() - startTime;
    
    // Log for debugging
    if (diagnosticsEnabled && debugInfo.current.processedSignals % 30 === 0) {
      debugInfo.current.signalLog.push({
        timestamp: Date.now(),
        value,
        result: { ...result },
        neuralUsed: processorRef.current.isNeuralProcessingEnabled()
      });
      
      // Keep log size manageable
      if (debugInfo.current.signalLog.length > 20) {
        debugInfo.current.signalLog.shift();
      }
      
      // Detailed log
      console.log(`Signal processed in ${processingTime.toFixed(2)}ms [Neural: ${processorRef.current.isNeuralProcessingEnabled() ? 'ON' : 'OFF'}]`, {
        signalStrength: Math.abs(value),
        arrhythmiaCount: processorRef.current.getArrhythmiaCounter(),
        spo2: result.spo2,
        pressure: result.pressure,
        confidence: result.confidence?.overall || 0
      });
    }
    
    // Store valid results
    if (result.spo2 > 0) {
      setLastValidResults(result);
    }
    
    // Check for arrhythmia and update windows
    if (result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED")) {
      const now = Date.now();
      setArrhythmiaWindows(prev => {
        const newWindow = { start: now, end: now + 5000 };
        return [...prev, newWindow];
      });
    }
    
    return result;
  }, [diagnosticsEnabled]);
  
  // Reset the processor and return last valid results
  const reset = useCallback((): VitalSignsResult | null => {
    if (processorRef.current) {
      processorRef.current.reset();
    }
    return lastValidResults;
  }, [lastValidResults]);
  
  // Completely reset the processor
  const fullReset = useCallback((): void => {
    if (processorRef.current) {
      console.log("Full reset of HybridVitalSignsProcessor");
      processorRef.current.fullReset();
      setLastValidResults(null);
      setArrhythmiaWindows([]);
      debugInfo.current = {
        processedSignals: 0,
        signalLog: [],
        performanceMetrics: {
          avgProcessTime: 0,
          traditionalPercentage: 0,
          neuralPercentage: 0,
          hybridPercentage: 0,
          avgConfidence: 0
        },
        neuralInfo: {
          modelsLoaded: [],
          backend: '',
          webgpuEnabled: false
        }
      };
      clearDiagnosticsData(); // Clear diagnostics data
    }
  }, []);
  
  // Toggle diagnostics
  const toggleDiagnostics = useCallback((enabled: boolean): void => {
    setDiagnosticsEnabled(enabled);
    if (!enabled) {
      // Clear diagnostics data if disabled
      clearDiagnosticsData();
    }
    console.log(`Diagnostics ${enabled ? 'enabled' : 'disabled'}`);
  }, []);
  
  // Toggle neural processing
  const toggleNeuralProcessing = useCallback((enabled: boolean): void => {
    setNeuralEnabled(enabled);
    if (processorRef.current) {
      processorRef.current.setNeuralProcessing(enabled);
    }
    console.log(`Neural processing ${enabled ? 'enabled' : 'disabled'}`);
  }, []);
  
  // Update processor options
  const updateOptions = useCallback((options: Partial<HybridProcessingOptions>): void => {
    if (processorRef.current) {
      processorRef.current.updateOptions(options);
    }
  }, []);
  
  // Get diagnostics data from peak detection module
  const getPeakDetectionDiagnostics = useCallback(() => {
    return getDiagnosticsData();
  }, []);
  
  // Get neural information
  const getNeuralInfo = useCallback(() => {
    return tensorflowService.getTensorFlowInfo();
  }, []);
  
  return {
    processSignal,
    reset,
    fullReset,
    initializeProcessor,
    lastValidResults,
    arrhythmiaCounter: processorRef.current?.getArrhythmiaCounter() || 0,
    arrhythmiaWindows,
    debugInfo: debugInfo.current,
    diagnosticsEnabled,
    toggleDiagnostics,
    neuralEnabled,
    toggleNeuralProcessing,
    updateOptions,
    getPeakDetectionDiagnostics,
    getNeuralInfo
  };
}
