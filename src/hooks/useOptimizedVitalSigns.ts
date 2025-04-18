
/**
 * Hook for optimized vital signs processing
 * Integrates signal optimization with vital signs calculations
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { VitalSignsResult } from '../modules/vital-signs/types/vital-signs-result';
import { VitalSignsProcessor } from '../modules/vital-signs/VitalSignsProcessor';
import { useOptimizedSignals } from './useOptimizedSignals';
import { ResultFactory } from '../modules/vital-signs/factories/result-factory';

export function useOptimizedVitalSigns() {
  const [results, setResults] = useState<VitalSignsResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qualityMetrics, setQualityMetrics] = useState({
    signalQuality: 0,
    resultConfidence: 0,
    optimizationLevel: 0
  });
  
  const vitalSignsProcessorRef = useRef<VitalSignsProcessor | null>(null);
  const processedFramesRef = useRef(0);
  const lastResultTimeRef = useRef(0);
  const resultHistoryRef = useRef<VitalSignsResult[]>([]);
  
  // Use the optimized signals hook
  const {
    processValue: processOptimizedValue,
    startProcessing: startSignalProcessing,
    stopProcessing: stopSignalProcessing,
    provideResults,
    getChannel,
    reset: resetSignalProcessing,
    isProcessing: isSignalProcessing,
    signalQuality,
    optimizationStats
  } = useOptimizedSignals();
  
  // Initialize the vital signs processor
  useEffect(() => {
    vitalSignsProcessorRef.current = new VitalSignsProcessor();
    
    return () => {
      vitalSignsProcessorRef.current = null;
    };
  }, []);
  
  /**
   * Start processing vital signs with optimization
   */
  const startProcessing = useCallback(() => {
    console.log("useOptimizedVitalSigns: Starting optimized vital signs processing");
    setIsProcessing(true);
    startSignalProcessing();
    processedFramesRef.current = 0;
    lastResultTimeRef.current = 0;
    resultHistoryRef.current = [];
  }, [startSignalProcessing]);
  
  /**
   * Stop processing
   */
  const stopProcessing = useCallback(() => {
    console.log("useOptimizedVitalSigns: Stopping optimized vital signs processing");
    setIsProcessing(false);
    stopSignalProcessing();
  }, [stopSignalProcessing]);
  
  /**
   * Process a raw PPG value and calculate vital signs
   */
  const processValue = useCallback((value: number) => {
    if (!isProcessing || !vitalSignsProcessorRef.current) {
      return null;
    }
    
    try {
      // Process the raw signal with optimization
      const processedSignal = processOptimizedValue(value);
      processedFramesRef.current++;
      
      // Only calculate vital signs every 10 frames for efficiency
      const shouldCalculateVitalSigns = processedFramesRef.current % 10 === 0;
      
      if (shouldCalculateVitalSigns && processedSignal) {
        // Get the optimized heartbeat channel
        const heartbeatChannel = getChannel('heartbeat');
        
        if (heartbeatChannel) {
          // Get RR intervals from the channel for arrhythmia detection
          const rrIntervals = heartbeatChannel.getMetadata('rrIntervals') as number[] || [];
          const lastPeakTime = heartbeatChannel.getMetadata('lastPeakTime') as number | null;
          
          const rrData = {
            intervals: rrIntervals,
            lastPeakTime
          };
          
          // Calculate vital signs using the latest optimized value
          const optimizedValue = heartbeatChannel.getLastValue() || value;
          const result = vitalSignsProcessorRef.current.processSignal(optimizedValue, rrData, calculateOptimizationLevel(optimizationStats));
          
          // Update results
          setResults(result);
          
          // Add to history (keep last 5)
          resultHistoryRef.current.push(result);
          if (resultHistoryRef.current.length > 5) {
            resultHistoryRef.current.shift();
          }
          
          // Provide feedback to the optimization system
          provideResults(result);
          
          // Update quality metrics
          setQualityMetrics({
            signalQuality,
            resultConfidence: result.overallConfidence || 0,
            optimizationLevel: calculateOptimizationLevel(optimizationStats)
          });
          
          lastResultTimeRef.current = Date.now();
          return result;
        }
      }
      
      // Return last results if we didn't calculate new ones
      return results;
    } catch (error) {
      console.error("useOptimizedVitalSigns: Error processing value", error);
      return results;
    }
  }, [
    isProcessing, 
    results, 
    getChannel, 
    signalQuality, 
    optimizationStats, 
    provideResults,
    processOptimizedValue
  ]);
  
  /**
   * Calculate the overall optimization level
   */
  const calculateOptimizationLevel = (stats: Record<string, any>): number => {
    if (!stats || Object.keys(stats).length === 0) return 0;
    
    let sum = 0;
    let count = 0;
    
    for (const key in stats) {
      if (stats[key] && typeof stats[key].improvementFactor === 'number') {
        sum += stats[key].improvementFactor;
        count++;
      }
    }
    
    return count > 0 ? sum / count : 0;
  };
  
  /**
   * Get the average of recent results to smooth fluctuations
   */
  const getSmoothedResults = useCallback((): VitalSignsResult => {
    if (resultHistoryRef.current.length === 0) {
      return ResultFactory.createEmptyResults();
    }
    
    if (resultHistoryRef.current.length === 1) {
      return resultHistoryRef.current[0];
    }
    
    // Calculate the weighted average of the last few results (more weight to recent)
    const weights = resultHistoryRef.current.map((_, index) => {
      return (index + 1) / ((resultHistoryRef.current.length * (resultHistoryRef.current.length + 1)) / 2);
    });
    
    // SPO2 (weighted average)
    let spo2Sum = 0;
    resultHistoryRef.current.forEach((result, index) => {
      spo2Sum += result.spo2 * weights[index];
    });
    
    // Blood Pressure (use latest non-zero value)
    let pressure = "--/--";
    for (let i = resultHistoryRef.current.length - 1; i >= 0; i--) {
      if (resultHistoryRef.current[i].pressure !== "--/--") {
        pressure = resultHistoryRef.current[i].pressure;
        break;
      }
    }
    
    // Arrhythmia Status (use latest)
    const arrhythmiaStatus = resultHistoryRef.current[resultHistoryRef.current.length - 1].arrhythmiaStatus;
    
    // Glucose (weighted average)
    let glucoseSum = 0;
    resultHistoryRef.current.forEach((result, index) => {
      glucoseSum += result.glucose * weights[index];
    });
    
    // Lipids (weighted average)
    let totalCholesterolSum = 0;
    let triglyceridesSum = 0;
    resultHistoryRef.current.forEach((result, index) => {
      totalCholesterolSum += result.lipids.totalCholesterol * weights[index];
      triglyceridesSum += result.lipids.triglycerides * weights[index];
    });
    
    // Hemoglobin (weighted average)
    let hemoglobinSum = 0;
    resultHistoryRef.current.forEach((result, index) => {
      hemoglobinSum += result.hemoglobin * weights[index];
    });
    
    // Hydration (weighted average)
    let hydrationSum = 0;
    resultHistoryRef.current.forEach((result, index) => {
      hydrationSum += result.hydration * weights[index];
    });
    
    // Confidence values (use latest)
    const latest = resultHistoryRef.current[resultHistoryRef.current.length - 1];
    
    return ResultFactory.createResult(
      Math.round(spo2Sum),
      pressure,
      arrhythmiaStatus,
      Math.round(glucoseSum),
      {
        totalCholesterol: Math.round(totalCholesterolSum),
        triglycerides: Math.round(triglyceridesSum)
      },
      Math.round(hemoglobinSum),
      Math.round(hydrationSum),
      latest.glucoseConfidence,
      latest.lipidsConfidence,
      latest.overallConfidence,
      latest.lastArrhythmiaData
    );
  }, []);
  
  /**
   * Reset the vital signs processor
   */
  const reset = useCallback(() => {
    if (vitalSignsProcessorRef.current) {
      vitalSignsProcessorRef.current.reset();
    }
    
    resetSignalProcessing();
    setResults(null);
    processedFramesRef.current = 0;
    lastResultTimeRef.current = 0;
    resultHistoryRef.current = [];
    
    setQualityMetrics({
      signalQuality: 0,
      resultConfidence: 0,
      optimizationLevel: 0
    });
  }, [resetSignalProcessing]);
  
  return {
    processValue,
    startProcessing,
    stopProcessing,
    reset,
    results,
    getSmoothedResults,
    isProcessing,
    qualityMetrics,
    optimizationStats,
    lastUpdateTime: lastResultTimeRef.current,
    processedFrames: processedFramesRef.current
  };
}
