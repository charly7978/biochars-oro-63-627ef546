/**
 * Hook for optimized vital signs processing with bidirectional feedback
 * Only processes real data - no simulation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useVitalSignsProcessor } from './useVitalSignsProcessor';
import { VitalSignsResult } from '@/modules/vital-signs/types/vital-signs-result';
import bidirectionalFeedbackService, { FeedbackData, VitalSignMetric } from '@/services/BidirectionalFeedbackService';
import { toast } from "sonner";

export const useOptimizedVitalSigns = () => {
  // Use the base vital signs processor
  const {
    processSignal: baseProcessSignal,
    reset: baseReset,
    fullReset: baseFullReset,
    lastValidResults,
    arrhythmiaWindows,
    debugInfo
  } = useVitalSignsProcessor();
  
  // Tracking for optimization
  const [optimizationStats, setOptimizationStats] = useState({
    optimizationsApplied: 0,
    signalQualityImprovements: 0,
    confidenceImprovements: 0
  });
  
  // Signal quality tracking
  const signalQualityRef = useRef<number>(0);
  const lastResultsRef = useRef<VitalSignsResult | null>(null);
  
  /**
   * Process each vital sign with bidirectional feedback and optimization
   */
  const processSignal = useCallback((
    value: number, 
    rrData?: { intervals: number[], lastPeakTime: number | null }
  ): VitalSignsResult => {
    // Call the base processor
    const result = baseProcessSignal(value, rrData);
    
    // Store last results for optimization
    lastResultsRef.current = result;
    
    // Update signal quality based on value characteristics
    let signalQuality = value <= 0 ? 0 : Math.min(100, Math.max(0, 
      value > 0.9 ? 95 : // Strong signal
      value > 0.5 ? 80 : // Good signal
      value > 0.2 ? 60 : // Moderate signal
      value > 0.1 ? 40 : // Weak signal
      20 // Very weak signal
    ));
    
    // Store current signal quality
    signalQualityRef.current = signalQuality;
    
    // Process results through the bidirectional feedback system
    if (value > 0 && result) {
      bidirectionalFeedbackService.processVitalSignsResults(result, signalQuality);
      
      // Generate audio feedback if needed
      bidirectionalFeedbackService.generateAudioFeedback();
      
      // Apply UI feedback every 30 calls to avoid notification overload
      if (Math.random() < 0.03) { // ~3% chance per call
        bidirectionalFeedbackService.applyUIFeedback();
      }
    }
    
    return result;
  }, [baseProcessSignal]);
  
  /**
   * Hard reset all systems
   */
  const reset = useCallback(() => {
    // Reset base processor
    const result = baseReset();
    
    // Reset optimization stats
    setOptimizationStats({
      optimizationsApplied: 0,
      signalQualityImprovements: 0,
      confidenceImprovements: 0
    });
    
    return result;
  }, [baseReset]);
  
  /**
   * Full reset of all systems
   */
  const fullReset = useCallback(() => {
    baseFullReset();
    
    // Reset optimization stats
    setOptimizationStats({
      optimizationsApplied: 0,
      signalQualityImprovements: 0,
      confidenceImprovements: 0
    });
    
    // Notify about reset
    toast("Sistema reiniciado", {
      description: "Todos los valores y optimizaciones han sido reiniciados",
      duration: 3000
    });
  }, [baseFullReset]);
  
  /**
   * Subscribe to feedback channels for optimization
   */
  useEffect(() => {
    // Listen for heart rate optimizations
    const handleHeartRateOptimization = (data: FeedbackData) => {
      if (data.optimizationApplied) {
        setOptimizationStats(prev => ({
          ...prev,
          optimizationsApplied: prev.optimizationsApplied + 1
        }));
      }
    };
    
    // Setup feedback listeners
    bidirectionalFeedbackService.subscribe('heartRate', handleHeartRateOptimization);
    
    return () => {
      // Remove listeners on unmount
      bidirectionalFeedbackService.unsubscribe('heartRate', handleHeartRateOptimization);
    };
  }, []);
  
  /**
   * Get optimization advice for improved measurements
   */
  const getOptimizationAdvice = useCallback((metric: VitalSignMetric) => {
    return bidirectionalFeedbackService.getOptimizationAdvice(metric);
  }, []);
  
  /**
   * Get current signal quality
   */
  const getCurrentSignalQuality = useCallback(() => {
    return signalQualityRef.current;
  }, []);
  
  /**
   * Get optimization statistics
   */
  const getOptimizationStats = useCallback(() => {
    return optimizationStats;
  }, [optimizationStats]);
  
  /**
   * Get feedback data for a specific metric
   */
  const getFeedbackData = useCallback((metric: VitalSignMetric) => {
    return bidirectionalFeedbackService.getLatestFeedback(metric);
  }, []);
  
  return {
    processSignal,
    reset,
    fullReset,
    lastValidResults,
    arrhythmiaWindows,
    debugInfo,
    optimizationStats,
    getOptimizationAdvice,
    getCurrentSignalQuality,
    getOptimizationStats,
    getFeedbackData
  };
};

export default useOptimizedVitalSigns;
