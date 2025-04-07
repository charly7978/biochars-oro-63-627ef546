import { useEffect, useState, useCallback, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import { initializeTensorFlow, disposeTensors, getMemoryUsage } from '../utils/tfModelInitializer';
import { toast } from './use-toast';
import { logSignalProcessing, LogLevel, trackPerformanceAsync } from '../utils/signalLogging';

interface UseTensorFlowIntegrationReturn {
  isTensorFlowReady: boolean;
  tensorflowVersion: string;
  tensorflowBackend: string;
  isWebGPUAvailable: boolean;
  isWebGLAvailable: boolean;
  reinitializeTensorFlow: () => Promise<boolean>;
  disposeResources: () => void;
  memoryUsage: { numTensors: number, numMB: number };
  isInitializing: boolean;
}

/**
 * Hook for managing TensorFlow.js integration
 * Enhanced with robust error handling, memory monitoring, and performance tracking
 */
export function useTensorFlowIntegration(): UseTensorFlowIntegrationReturn {
  const [isTensorFlowReady, setIsTensorFlowReady] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [tensorflowVersion, setTensorflowVersion] = useState<string>('');
  const [tensorflowBackend, setTensorflowBackend] = useState<string>('');
  const [isWebGPUAvailable, setIsWebGPUAvailable] = useState<boolean>(false);
  const [isWebGLAvailable, setIsWebGLAvailable] = useState<boolean>(false);
  const [memoryUsage, setMemoryUsage] = useState<{ numTensors: number, numMB: number }>({ numTensors: 0, numMB: 0 });
  
  const initializationAttemptsRef = useRef<number>(0);
  const memoryMonitorIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      try {
        setIsInitializing(true);
        initializationAttemptsRef.current += 1;
        
        logSignalProcessing(
          LogLevel.INFO, 
          'TensorFlow', 
          `Initializing TensorFlow.js (attempt ${initializationAttemptsRef.current})`,
          { timestamp: new Date().toISOString() }
        );
        
        const success = await trackPerformanceAsync(
          'TensorFlow',
          'initialization',
          async () => await initializeTensorFlow()
        );
        
        if (!isMounted) return;
        
        if (success) {
          setIsTensorFlowReady(true);
          
          const version = tf.version.tfjs;
          const backend = tf.getBackend() || 'none';
          const hasWebGL = tf.ENV.getBool('HAS_WEBGL');
          const hasWebGPU = tf.engine().backendNames().includes('webgpu');
          
          setTensorflowVersion(version);
          setTensorflowBackend(backend);
          setIsWebGLAvailable(hasWebGL);
          setIsWebGPUAvailable(hasWebGPU);
          
          logSignalProcessing(
            LogLevel.INFO, 
            'TensorFlow', 
            'TensorFlow.js initialized successfully', 
            {
              version,
              backend,
              webgl: hasWebGL,
              webgpu: hasWebGPU
            }
          );
          
          startMemoryMonitoring();
        } else {
          logSignalProcessing(
            LogLevel.ERROR, 
            'TensorFlow', 
            'Failed to initialize TensorFlow'
          );
          
          if (initializationAttemptsRef.current <= 2) {
            toast({
              title: "TensorFlow initialization failed",
              description: "Using fallback algorithms for signal processing",
              variant: "destructive"
            });
          }
        }
      } catch (error) {
        if (!isMounted) return;
        
        logSignalProcessing(
          LogLevel.ERROR,
          'TensorFlow',
          'Error during TensorFlow initialization',
          { error }
        );
        
        setIsTensorFlowReady(false);
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };
    
    initialize();
    
    return () => {
      isMounted = false;
      if (memoryMonitorIntervalRef.current) {
        clearInterval(memoryMonitorIntervalRef.current);
        memoryMonitorIntervalRef.current = null;
      }
      
      try {
        disposeTensors();
        logSignalProcessing(LogLevel.INFO, 'TensorFlow', 'Resources disposed on unmount');
      } catch (error) {
        logSignalProcessing(
          LogLevel.WARN, 
          'TensorFlow', 
          'Error disposing TensorFlow resources on unmount',
          { error }
        );
      }
    };
  }, []);
  
  const startMemoryMonitoring = useCallback(() => {
    if (memoryMonitorIntervalRef.current) {
      clearInterval(memoryMonitorIntervalRef.current);
    }
    
    memoryMonitorIntervalRef.current = window.setInterval(() => {
      if (isTensorFlowReady) {
        try {
          const usage = getMemoryUsage().current;
          setMemoryUsage(usage);
          
          if (usage.numTensors > 1000 || usage.numMB > 100) {
            logSignalProcessing(
              LogLevel.WARN,
              'TensorFlow',
              'High memory usage detected',
              { tensors: usage.numTensors, megabytes: usage.numMB.toFixed(2) }
            );
            
            if (usage.numTensors > 5000 || usage.numMB > 200) {
              logSignalProcessing(
                LogLevel.WARN,
                'TensorFlow',
                'Critical memory usage - performing emergency cleanup',
                { tensors: usage.numTensors, megabytes: usage.numMB.toFixed(2) }
              );
              
              disposeTensors();
              
              toast({
                title: "Memory warning",
                description: "High tensor count detected. Emergency cleanup performed.",
                variant: "destructive"
              });
            }
          }
        } catch (error) {
          logSignalProcessing(
            LogLevel.WARN, 
            'TensorFlow',
            'Error checking TensorFlow memory',
            { error }
          );
        }
      }
    }, 10000);
    
    return () => {
      if (memoryMonitorIntervalRef.current) {
        clearInterval(memoryMonitorIntervalRef.current);
        memoryMonitorIntervalRef.current = null;
      }
    };
  }, [isTensorFlowReady]);
  
  const reinitializeTensorFlow = useCallback(async (): Promise<boolean> => {
    try {
      setIsInitializing(true);
      logSignalProcessing(LogLevel.INFO, 'TensorFlow', 'Reinitializing TensorFlow.js');
      
      disposeTensors();
      
      const success = await trackPerformanceAsync(
        'TensorFlow',
        'reinitialization',
        async () => initializeTensorFlow()
      );
      
      if (success) {
        setIsTensorFlowReady(true);
        setTensorflowVersion(tf.version.tfjs);
        setTensorflowBackend(tf.getBackend() || 'none');
        setIsWebGLAvailable(tf.ENV.getBool('HAS_WEBGL'));
        setIsWebGPUAvailable(tf.engine().backendNames().includes('webgpu'));
        
        startMemoryMonitoring();
        
        toast({
          title: "TensorFlow reinitialized",
          description: `Using ${tf.getBackend()} backend`,
          variant: "default"
        });
        
        logSignalProcessing(
          LogLevel.INFO,
          'TensorFlow',
          'TensorFlow.js reinitialized successfully',
          { backend: tf.getBackend() }
        );
        
        return true;
      } else {
        setIsTensorFlowReady(false);
        
        toast({
          title: "TensorFlow reinitialization failed",
          description: "Using fallback algorithms",
          variant: "destructive"
        });
        
        logSignalProcessing(
          LogLevel.ERROR,
          'TensorFlow',
          'TensorFlow.js reinitialization failed'
        );
        
        return false;
      }
      
    } catch (error) {
      logSignalProcessing(
        LogLevel.ERROR,
        'TensorFlow',
        'Error during TensorFlow reinitialization',
        { error }
      );
      
      setIsTensorFlowReady(false);
      setIsInitializing(false);
      
      toast({
        title: "Error",
        description: "Failed to reinitialize TensorFlow",
        variant: "destructive"
      });
      
      return false;
    }
  }, [startMemoryMonitoring]);
  
  const disposeResources = useCallback(() => {
    try {
      disposeTensors();
      logSignalProcessing(LogLevel.INFO, 'TensorFlow', 'Resources disposed by user request');
    } catch (error) {
      logSignalProcessing(
        LogLevel.ERROR,
        'TensorFlow',
        'Error disposing TensorFlow resources',
        { error }
      );
    }
  }, []);

  return {
    isTensorFlowReady,
    tensorflowVersion,
    tensorflowBackend,
    isWebGPUAvailable,
    isWebGLAvailable,
    reinitializeTensorFlow,
    disposeResources,
    memoryUsage,
    isInitializing
  };
}
