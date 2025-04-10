import { useState, useRef, useEffect, useCallback } from 'react';
import { TFVitalSignsProcessor } from '../modules/vital-signs/TFVitalSignsProcessor';
import { VitalSignsResult } from '../modules/vital-signs/types/vital-signs-result';
import { RRIntervalData } from './heart-beat/types';
import { initializeTensorFlow, disposeTensors } from '../utils/tfModelInitializer';
import { toast } from './use-toast';

export interface UseTensorFlowVitalSignsReturn {
  processSignal: (value: number, rrData?: RRIntervalData, isWeakSignal?: boolean) => Promise<VitalSignsResult>;
  reset: () => void;
  fullReset: () => void;
  arrhythmiaCounter: number;
  isTensorFlowReady: boolean;
  isInitializing: boolean;
  arrhythmiaWindows: Array<{ start: number, end: number }>;
  debugInfo: any;
}

/**
 * Hook for TensorFlow-based vital signs processing
 */
export const useTensorFlowVitalSigns = (): UseTensorFlowVitalSignsReturn => {
  const [isTensorFlowReady, setIsTensorFlowReady] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const processorRef = useRef<TFVitalSignsProcessor | null>(null);
  const arrhythmiaWindowsRef = useRef<Array<{ start: number, end: number }>>([]);
  const sessionIdRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Initialize TensorFlow and processor
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsInitializing(true);
        console.log("useTensorFlowVitalSigns: Initializing TensorFlow", {
          sessionId: sessionIdRef.current,
          timestamp: new Date().toISOString()
        });
        
        // Initialize TensorFlow
        const tfInitialized = await initializeTensorFlow();
        
        if (!tfInitialized) {
          console.error("Failed to initialize TensorFlow");
          toast({
            title: "TensorFlow initialization failed",
            description: "Advanced vital signs processing will be limited",
            variant: "destructive"
          });
          setIsInitializing(false);
          return;
        }
        
        setIsTensorFlowReady(true);
        
        // Create processor instance
        if (!processorRef.current) {
          processorRef.current = new TFVitalSignsProcessor();
          console.log("useTensorFlowVitalSigns: Processor created");
        }
        
        setIsInitializing(false);
      } catch (error) {
        console.error("Error initializing TensorFlow:", error);
        toast({
          title: "Initialization Error",
          description: "Failed to set up vital signs processing",
          variant: "destructive"
        });
        setIsInitializing(false);
      }
    };
    
    initialize();
    
    // Cleanup
    return () => {
      if (processorRef.current) {
        processorRef.current.dispose();
        processorRef.current = null;
      }
      
      disposeTensors();
      console.log("useTensorFlowVitalSigns: Cleaned up resources");
    };
  }, []);
  
  /**
   * Process PPG signal to calculate vital signs
   */
  const processSignal = useCallback(async (
    value: number, 
    rrData?: RRIntervalData,
    isWeakSignal: boolean = false
  ): Promise<VitalSignsResult> => {
    if (!processorRef.current) {
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "NOT_INITIALIZED|0",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        }
      };
    }
    
    try {
      // Process the signal with TensorFlow
      const result = await processorRef.current.processSignal(value, rrData, isWeakSignal);
      
      // Handle arrhythmia visualization
      if (result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") && result.lastArrhythmiaData) {
        const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
        
        // Create window around the arrhythmia
        const windowWidth = 500; // ms
        arrhythmiaWindowsRef.current.push({
          start: arrhythmiaTime - windowWidth/2,
          end: arrhythmiaTime + windowWidth/2
        });
        
        // Keep only recent windows
        const now = Date.now();
        arrhythmiaWindowsRef.current = arrhythmiaWindowsRef.current.filter(
          window => now - window.end < 10000
        );
      }
      
      return result;
    } catch (error) {
      console.error("Error processing signal with TensorFlow:", error);
      
      // Return empty result on error
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "ERROR|0",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        }
      };
    }
  }, []);
  
  /**
   * Reset processor
   */
  const reset = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.reset();
    }
    
    // Clear arrhythmia windows
    arrhythmiaWindowsRef.current = [];
    
    return null;
  }, []);
  
  /**
   * Full reset including arrhythmia counter
   */
  const fullReset = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.fullReset();
    }
    
    // Clear arrhythmia windows
    arrhythmiaWindowsRef.current = [];
  }, []);
  
  /**
   * Get debug information
   */
  const getDebugInfo = useCallback(() => {
    return {
      tensorflowReady: isTensorFlowReady,
      sessionId: sessionIdRef.current,
      arrhythmiaWindows: arrhythmiaWindowsRef.current.length,
      processorInitialized: !!processorRef.current
    };
  }, [isTensorFlowReady]);
  
  return {
    processSignal,
    reset,
    fullReset,
    arrhythmiaCounter: processorRef.current?.getArrhythmiaCounter() || 0,
    isTensorFlowReady,
    isInitializing,
    arrhythmiaWindows: arrhythmiaWindowsRef.current,
    debugInfo: getDebugInfo()
  };
};
