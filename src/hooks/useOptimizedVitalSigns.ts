/**
 * Hook for optimized vital signs processing with bidirectional feedback
 * Only processes real data - no simulation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useVitalSignsProcessor, DetailedSignalQuality } from './useVitalSignsProcessor';
import { VitalSignsResult } from '@/modules/vital-signs/types/vital-signs-result';
import BidirectionalFeedbackService, { FeedbackData, VitalSignMetric } from '@/services/BidirectionalFeedbackService';
import { toast } from "@/components/ui/use-toast";

export const useOptimizedVitalSigns = () => {
  // Use the base vital signs processor
  const {
    processSignal: baseProcessSignal,
    reset: baseReset,
    fullReset: baseFullReset,
    lastValidResults,
    arrhythmiaWindows,
    debugInfo,
    getDetailedQuality
  } = useVitalSignsProcessor();
  
  // Tracking for optimization
  const [optimizationStats, setOptimizationStats] = useState({
    optimizationsApplied: 0,
    signalQualityImprovements: 0,
    confidenceImprovements: 0
  });
  
  // --- Keep track of detailed quality --- START ---
  const [detailedQuality, setDetailedQuality] = useState<DetailedSignalQuality>({ cardiacClarity: 0, ppgStability: 0, overallQuality: 0 });
  // --- Keep track of detailed quality --- END ---
  
  // Signal quality tracking
  const signalQualityRef = useRef<number>(0);
  const lastResultsRef = useRef<VitalSignsResult | null>(null);
  
  /**
   * Process each vital sign with bidirectional feedback and optimization
   */
  const processSignal = useCallback((
    value: number, 
    rrData?: { intervals: number[], lastPeakTime: number | null },
  ): VitalSignsResult | null => {
    // Call the base processor
    const result = baseProcessSignal(value, rrData);
    
    // --- Update detailed quality state --- START ---
    const newDetailedQuality = getDetailedQuality(); // Get latest detailed quality
    setDetailedQuality(newDetailedQuality);
    signalQualityRef.current = newDetailedQuality.overallQuality; // Use overall from detailed
    // --- Update detailed quality state --- END ---
    
    // Store last results for optimization
    lastResultsRef.current = result;
    
    // Only process feedback if we got a valid result
    if (result) {
      // Get the quality to send to feedback service (using overall detailed quality)
      const currentOverallQuality = newDetailedQuality.overallQuality;
      
      BidirectionalFeedbackService.processVitalSignsResults(result, currentOverallQuality);
      
      // Generate audio feedback if needed
      BidirectionalFeedbackService.generateAudioFeedback();
      
      // Apply UI feedback every 30 calls to avoid notification overload
      if (Math.random() < 0.03) { // ~3% chance per call
        BidirectionalFeedbackService.applyUIFeedback();
      }
    } else {
      // Handle the null case if necessary (e.g., clear some UI elements?)
      // console.log("useOptimizedVitalSigns: Received null result from base processor.");
    }
    
    return result;
  }, [baseProcessSignal, getDetailedQuality]);
  
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
    
    // Reset detailed quality state
    setDetailedQuality({ cardiacClarity: 0, ppgStability: 0, overallQuality: 0 });
    
    signalQualityRef.current = 0;
    lastResultsRef.current = null;
    
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
    
    // Reset detailed quality state
    setDetailedQuality({ cardiacClarity: 0, ppgStability: 0, overallQuality: 0 });
    
    signalQualityRef.current = 0;
    lastResultsRef.current = null;
    
    // Notify about reset
    toast({
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
    BidirectionalFeedbackService.subscribe('heartRate', handleHeartRateOptimization);
    
    return () => {
      // Remove listeners on unmount
      BidirectionalFeedbackService.unsubscribe('heartRate', handleHeartRateOptimization);
    };
  }, []);
  
  /**
   * Get optimization advice for improved measurements
   */
  const getOptimizationAdvice = useCallback((metric: VitalSignMetric) => {
    return BidirectionalFeedbackService.getOptimizationAdvice(metric);
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
    return BidirectionalFeedbackService.getLatestFeedback(metric);
  }, []);
  
  // Expose the detailed quality state
  const getCurrentDetailedQuality = useCallback(() => {
    return detailedQuality;
  }, [detailedQuality]);
  
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
    getFeedbackData,
    getCurrentDetailedQuality
  };
};

export default useOptimizedVitalSigns;
