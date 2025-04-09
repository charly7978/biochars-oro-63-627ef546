
import { useState, useCallback, useEffect, useRef } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../core/VitalSignsProcessor';
import { ProcessorConfig, DEFAULT_PROCESSOR_CONFIG } from '../core/config/ProcessorConfig';
import { RRData } from '../core/signal/PeakDetector';
import { UnifiedQualityEvaluator, QualityResult } from '../core/signal/unified-quality-evaluator';
import { FeedbackSystem } from '../core/feedback/feedback-system';
import { ProcessorFeedbackNetwork, ProcessorFeedbackListener } from '../core/feedback/processor-feedback-network';

export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: RRData) => VitalSignsResult;
  reset: () => VitalSignsResult | null;
  calibrate: () => void;
  isCalibrating: boolean;
  fullReset: () => void;
  lastValidResults: VitalSignsResult | null;
  qualityResult: QualityResult | null;
  feedbackSystem: FeedbackSystem;
}

/**
 * Enhanced hook for using the VitalSignsProcessor with integrated feedback
 * and quality evaluation systems
 */
export const useVitalSignsProcessor = (
  config?: Partial<ProcessorConfig>
): UseVitalSignsProcessorReturn => {
  const [processor] = useState<VitalSignsProcessor>(() => 
    new VitalSignsProcessor({ ...DEFAULT_PROCESSOR_CONFIG, ...config })
  );
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [lastResults, setLastResults] = useState<VitalSignsResult | null>(null);
  const [qualityResult, setQualityResult] = useState<QualityResult | null>(null);
  
  // Create feedback systems
  const feedbackSystemRef = useRef<FeedbackSystem>(new FeedbackSystem());
  const qualityEvaluatorRef = useRef<UnifiedQualityEvaluator>(
    new UnifiedQualityEvaluator({ ...DEFAULT_PROCESSOR_CONFIG, ...config }, feedbackSystemRef.current)
  );
  const feedbackNetworkRef = useRef<ProcessorFeedbackNetwork>(
    new ProcessorFeedbackNetwork(feedbackSystemRef.current)
  );
  
  // Buffer for signal history
  const signalBufferRef = useRef<number[]>([]);
  const MAX_BUFFER_SIZE = 100;
  
  // Register as a feedback listener
  useEffect(() => {
    const listener: ProcessorFeedbackListener = {
      onFeedbackReceived: (feedback) => {
        // Process incoming feedback
        if (feedback.qualityResult) {
          // Update quality result if from another processor
          if (feedback.sourceProcessor !== 'vitalSignsProcessor') {
            setQualityResult(prevQuality => {
              if (!prevQuality) {
                return feedback.qualityResult || null;
              }
              return {
                ...prevQuality,
                ...feedback.qualityResult,
                metrics: {
                  ...prevQuality.metrics,
                  ...(feedback.qualityResult?.metrics || {})
                }
              };
            });
          }
        }
      }
    };
    
    feedbackNetworkRef.current.registerProcessor('vitalSignsProcessor', listener);
    
    return () => {
      feedbackNetworkRef.current.unregisterProcessor('vitalSignsProcessor', listener);
    };
  }, []);

  /**
   * Process a signal value and return vital signs with quality evaluation
   */
  const processSignal = useCallback((value: number, rrData?: RRData): VitalSignsResult => {
    // Add value to signal buffer
    signalBufferRef.current.push(value);
    if (signalBufferRef.current.length > MAX_BUFFER_SIZE) {
      signalBufferRef.current.shift();
    }
    
    // Evaluate signal quality
    const quality = qualityEvaluatorRef.current.evaluateQuality(
      signalBufferRef.current, 
      'vitalSignsProcessor'
    );
    
    // Share quality result with other processors
    feedbackNetworkRef.current.sendFeedback({
      sourceProcessor: 'vitalSignsProcessor',
      targetProcessor: 'all',
      qualityResult: quality,
      timestamp: Date.now()
    });
    
    // Update quality result state
    setQualityResult(quality);
    
    // Process the signal only if quality is sufficient
    const results = processor.processSignal(value, rrData);
    
    // Enhance results with quality information
    const enhancedResults = {
      ...results,
      quality: {
        score: quality.score,
        isValid: quality.isValid
      }
    };
    
    // Update last results
    setLastResults(enhancedResults);
    
    return enhancedResults;
  }, [processor]);

  /**
   * Reset the processor
   */
  const reset = useCallback(() => {
    setIsCalibrating(false);
    signalBufferRef.current = [];
    qualityEvaluatorRef.current.reset();
    return processor.reset();
  }, [processor]);

  /**
   * Full reset of the processor
   */
  const fullReset = useCallback(() => {
    setIsCalibrating(false);
    setLastResults(null);
    setQualityResult(null);
    signalBufferRef.current = [];
    qualityEvaluatorRef.current.reset();
    feedbackSystemRef.current.clearFeedbacks();
    feedbackNetworkRef.current.reset();
    processor.fullReset();
  }, [processor]);

  /**
   * Start calibration
   */
  const calibrate = useCallback(() => {
    setIsCalibrating(true);
    signalBufferRef.current = [];
    processor.startCalibration();
    
    // Add feedback for calibration
    feedbackSystemRef.current.addFeedback(
      'Calibration started, please hold still',
      'info',
      { action: 'calibration', state: 'started' }
    );
  }, [processor]);

  return {
    processSignal,
    reset,
    calibrate,
    isCalibrating,
    fullReset,
    lastValidResults: lastResults,
    qualityResult,
    feedbackSystem: feedbackSystemRef.current
  };
};
