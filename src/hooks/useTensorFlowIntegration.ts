
import { useEffect, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import { initializeTensorFlow, disposeTensors } from '../utils/tfModelInitializer';
import { toast } from './use-toast';

interface UseTensorFlowIntegrationReturn {
  isTensorFlowReady: boolean;
  tensorflowVersion: string;
  tensorflowBackend: string;
  isWebGLAvailable: boolean;
  reinitializeTensorFlow: () => Promise<boolean>;
  disposeResources: () => void;
}

/**
 * Hook for managing TensorFlow.js integration
 * Handles initialization, monitoring, and resource cleanup
 */
export function useTensorFlowIntegration(): UseTensorFlowIntegrationReturn {
  const [isTensorFlowReady, setIsTensorFlowReady] = useState<boolean>(false);
  const [tensorflowVersion, setTensorflowVersion] = useState<string>('');
  const [tensorflowBackend, setTensorflowBackend] = useState<string>('');
  const [isWebGLAvailable, setIsWebGLAvailable] = useState<boolean>(false);

  // Initialize TensorFlow
  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      try {
        const success = await initializeTensorFlow();
        
        if (!isMounted) return;
        
        if (success) {
          setIsTensorFlowReady(true);
          setTensorflowVersion(tf.version.tfjs);
          setTensorflowBackend(tf.getBackend() || 'none');
          setIsWebGLAvailable(tf.ENV.getBool('HAS_WEBGL'));
          
          console.log("TensorFlow.js initialized successfully", {
            version: tf.version.tfjs,
            backend: tf.getBackend(),
            webgl: tf.ENV.getBool('HAS_WEBGL')
          });
        } else {
          console.error("Failed to initialize TensorFlow");
          
          // Show toast only on initial failure
          toast({
            title: "TensorFlow initialization failed",
            description: "Using fallback algorithms for signal processing",
            variant: "destructive"
          });
        }
      } catch (error) {
        if (!isMounted) return;
        
        console.error("Error initializing TensorFlow:", error);
        setIsTensorFlowReady(false);
      }
    };
    
    initialize();
    
    // Set up memory monitoring
    const memoryMonitorInterval = setInterval(() => {
      if (isTensorFlowReady) {
        try {
          const memoryInfo = tf.memory();
          
          // Check for memory leaks
          if (memoryInfo.numTensors > 1000) {
            console.warn("High tensor count detected:", memoryInfo.numTensors);
            toast({
              title: "Memory warning",
              description: "High tensor count detected. Performance may degrade.",
              variant: "destructive"
            });
            
            // Clean up unused tensors
            tf.tidy(() => {});
          }
        } catch (error) {
          console.warn("Error checking TensorFlow memory:", error);
        }
      }
    }, 10000);
    
    return () => {
      isMounted = false;
      clearInterval(memoryMonitorInterval);
      
      // Clean up TensorFlow resources
      try {
        disposeTensors();
      } catch (error) {
        console.warn("Error disposing TensorFlow resources:", error);
      }
    };
  }, []);
  
  /**
   * Re-initialize TensorFlow
   */
  const reinitializeTensorFlow = useCallback(async (): Promise<boolean> => {
    try {
      // Dispose existing resources
      disposeTensors();
      
      // Re-initialize
      const success = await initializeTensorFlow();
      
      if (success) {
        setIsTensorFlowReady(true);
        setTensorflowVersion(tf.version.tfjs);
        setTensorflowBackend(tf.getBackend() || 'none');
        setIsWebGLAvailable(tf.ENV.getBool('HAS_WEBGL'));
        
        toast({
          title: "TensorFlow reinitialized",
          description: `Using ${tf.getBackend()} backend`,
          variant: "default"
        });
      } else {
        setIsTensorFlowReady(false);
        
        toast({
          title: "TensorFlow reinitialization failed",
          description: "Using fallback algorithms",
          variant: "destructive"
        });
      }
      
      return success;
    } catch (error) {
      console.error("Error reinitializing TensorFlow:", error);
      setIsTensorFlowReady(false);
      
      toast({
        title: "Error",
        description: "Failed to reinitialize TensorFlow",
        variant: "destructive"
      });
      
      return false;
    }
  }, []);
  
  /**
   * Dispose TensorFlow resources
   */
  const disposeResources = useCallback(() => {
    try {
      disposeTensors();
      console.log("TensorFlow resources disposed");
    } catch (error) {
      console.error("Error disposing TensorFlow resources:", error);
    }
  }, []);

  return {
    isTensorFlowReady,
    tensorflowVersion,
    tensorflowBackend,
    isWebGLAvailable,
    reinitializeTensorFlow,
    disposeResources
  };
}
