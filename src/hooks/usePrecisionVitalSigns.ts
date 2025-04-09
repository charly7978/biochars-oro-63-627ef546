
/**
 * Hook for high-precision vital signs extraction
 * Combines traditional algorithms with TensorFlow models
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useSignalProcessing } from './useSignalProcessing';
import { tensorflowService } from '../modules/ai/tensorflow-service';
import { ModelType } from '../modules/ai/tensorflow-service';
import { PrecisionVitalSignsProcessor } from '../modules/vital-signs';
import type { ProcessedSignal } from '../types/signal';

export const usePrecisionVitalSigns = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelLoadStatus, setModelLoadStatus] = useState<Record<string, boolean>>({});
  const [useAI, setUseAI] = useState(true);
  const [neuralContribution, setNeuralContribution] = useState(0.6);
  const [diagnosticsMode, setDiagnosticsMode] = useState(false);
  
  const signalProcessing = useSignalProcessing();
  const processorRef = useRef<PrecisionVitalSignsProcessor | null>(null);
  
  // AI model loading status
  const areModelsLoaded = useCallback(() => {
    const requiredModels = [
      ModelType.SPO2,
      ModelType.BLOOD_PRESSURE,
      ModelType.GLUCOSE,
      ModelType.DENOISING
    ];
    
    return requiredModels.every(model => modelLoadStatus[model]);
  }, [modelLoadStatus]);
  
  // Initialize processor and load models
  useEffect(() => {
    const initializeProcessor = async () => {
      if (!processorRef.current) {
        processorRef.current = new PrecisionVitalSignsProcessor({
          useAI,
          neuralContribution,
          runDiagnostics: diagnosticsMode
        });
        
        console.log("Precision Vital Signs Processor initialized");
      }
      
      if (useAI) {
        await loadModels();
      }
    };
    
    initializeProcessor();
    
    return () => {
      console.log("Cleaning up Precision Vital Signs");
      processorRef.current = null;
    };
  }, [useAI, neuralContribution, diagnosticsMode]);
  
  // Load AI models
  const loadModels = useCallback(async () => {
    try {
      console.log("Loading AI models for vital signs");
      
      // Load SPO2 model
      const spo2Model = await tensorflowService.loadModel(ModelType.SPO2);
      setModelLoadStatus(prev => ({ ...prev, [ModelType.SPO2]: !!spo2Model }));
      
      // Load blood pressure model
      const bpModel = await tensorflowService.loadModel(ModelType.BLOOD_PRESSURE);
      setModelLoadStatus(prev => ({ ...prev, [ModelType.BLOOD_PRESSURE]: !!bpModel }));
      
      // Load glucose model
      const glucoseModel = await tensorflowService.loadModel(ModelType.GLUCOSE);
      setModelLoadStatus(prev => ({ ...prev, [ModelType.GLUCOSE]: !!glucoseModel }));
      
      // Load denoising model
      const denoisingModel = await tensorflowService.loadModel(ModelType.DENOISING);
      setModelLoadStatus(prev => ({ ...prev, [ModelType.DENOISING]: !!denoisingModel }));
      
      console.log("AI models loaded", tensorflowService.getTensorFlowInfo());
    } catch (error) {
      console.error("Error loading AI models:", error);
    }
  }, []);
  
  // Process a PPG signal
  const processSignal = useCallback(async (value: number, rrData?: any) => {
    if (!processorRef.current) {
      console.warn("Precision processor not initialized");
      return null;
    }
    
    // Process the signal with the signal processor first
    const processedSignal = signalProcessing.processValue(value);
    
    if (!processedSignal || !processedSignal.fingerDetected) {
      return null;
    }
    
    // Apply tensor-based denoising if AI is enabled
    let enhancedValue = processedSignal.filteredValue;
    
    if (useAI && modelLoadStatus[ModelType.DENOISING]) {
      try {
        enhancedValue = await tensorflowService.enhanceSignal([enhancedValue]);
        enhancedValue = enhancedValue[0]; // Get first value from array
      } catch (error) {
        console.error("Error applying AI enhancement:", error);
      }
    }
    
    // Create signal object for processor
    const signalForProcessing: ProcessedSignal = {
      timestamp: Date.now(),
      rawValue: processedSignal.rawValue,
      filteredValue: enhancedValue,
      quality: processedSignal.quality,
      fingerDetected: true,
      roi: { x: 0, y: 0, width: 100, height: 100 }
    };
    
    // Process the enhanced signal
    return processorRef.current.process(signalForProcessing, rrData);
  }, [signalProcessing, useAI, modelLoadStatus]);
  
  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (!areModelsLoaded() && useAI) {
      console.warn("AI models not fully loaded, but starting anyway");
    }
    
    signalProcessing.startProcessing();
    setIsProcessing(true);
  }, [signalProcessing, areModelsLoaded, useAI]);
  
  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    signalProcessing.stopProcessing();
    setIsProcessing(false);
  }, [signalProcessing]);
  
  // Toggle AI usage
  const toggleAI = useCallback((enable: boolean) => {
    setUseAI(enable);
    
    if (processorRef.current) {
      processorRef.current.configure({ useAI: enable });
    }
    
    if (enable && !areModelsLoaded()) {
      loadModels();
    }
  }, [areModelsLoaded, loadModels]);
  
  // Reset everything
  const reset = useCallback(() => {
    signalProcessing.reset();
    
    if (processorRef.current) {
      processorRef.current.reset();
    }
    
    setIsProcessing(false);
  }, [signalProcessing]);
  
  // Get diagnostics information
  const getDiagnostics = useCallback(() => {
    if (!processorRef.current || !diagnosticsMode) {
      return null;
    }
    
    return processorRef.current.getDiagnostics();
  }, [diagnosticsMode]);
  
  return {
    isProcessing,
    processSignal,
    startMonitoring,
    stopMonitoring,
    reset,
    toggleAI,
    setNeuralContribution,
    neuralContribution,
    areModelsLoaded: areModelsLoaded(),
    modelLoadStatus,
    useAI,
    getDiagnostics,
    setDiagnosticsMode,
    diagnosticsMode,
    tensorflowInfo: tensorflowService.getTensorFlowInfo()
  };
};
