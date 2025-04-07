
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrhythmiaDetector } from '../core/analysis/ArrhythmiaDetector';
import { calculateRMSSD, calculateRRVariation } from '../modules/vital-signs/arrhythmia/calculations';
import { RRIntervalData } from '../modules/vital-signs/arrhythmia/types';

/**
 * Consolidated hook for arrhythmia detection that integrates
 * various detection methods for better accuracy
 */
export function useArrhythmiaDetection() {
  const [isArrhythmia, setIsArrhythmia] = useState(false);
  const [arrhythmiaData, setArrhythmiaData] = useState<{
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null>(null);
  
  const [arrhythmiaCount, setArrhythmiaCount] = useState(0);
  const [arrhythmiaStatus, setArrhythmiaStatus] = useState('normal');
  
  // We'll use the more robust detector class from core/analysis
  const detectorRef = useRef<ArrhythmiaDetector>(new ArrhythmiaDetector());
  
  // Additional state for detecting patterns
  const rrIntervalsRef = useRef<number[]>([]);
  const consecutiveAbnormalBeatsRef = useRef(0);
  const lastDetectionTimeRef = useRef(0);
  
  // Enhanced detection sensitivity params
  const MIN_INTERVALS_REQUIRED = 5;
  const VARIATION_THRESHOLD = 0.15;
  const MIN_TIME_BETWEEN_DETECTIONS = 5000;
  
  /**
   * Detect arrhythmias using a consolidated approach that combines
   * methods from multiple detection systems
   */
  const detectArrhythmia = useCallback((rrData?: RRIntervalData) => {
    if (!rrData || !rrData.intervals || rrData.intervals.length < MIN_INTERVALS_REQUIRED) {
      return {
        isArrhythmia: false,
        arrhythmiaStatus: 'normal',
        count: arrhythmiaCount,
        data: null
      };
    }
    
    // Store intervals for additional analysis
    rrIntervalsRef.current = [...rrData.intervals];
    
    // Use the core detector class for primary detection
    const detectionResult = detectorRef.current.processRRData({
      intervals: rrData.intervals,
      lastPeakTime: rrData.lastPeakTime
    });
    
    // Additional validation using RMSSD and variation for cross-validation
    const recentIntervals = rrData.intervals.slice(-MIN_INTERVALS_REQUIRED);
    const rmssd = calculateRMSSD(recentIntervals);
    const rrVariation = calculateRRVariation(recentIntervals);
    
    // Is this a potential arrhythmia by our additional checks?
    const isVariationAbnormal = rrVariation > VARIATION_THRESHOLD;
    
    // Update consecutive abnormal beats counter
    if (isVariationAbnormal) {
      consecutiveAbnormalBeatsRef.current++;
    } else {
      consecutiveAbnormalBeatsRef.current = Math.max(0, consecutiveAbnormalBeatsRef.current - 1);
    }
    
    // Only trigger detection if enough time has passed since last one
    const now = Date.now();
    const timeSinceLastDetection = now - lastDetectionTimeRef.current;
    const canTriggerNewDetection = timeSinceLastDetection > MIN_TIME_BETWEEN_DETECTIONS;
    
    // Determine if we have an arrhythmia by either detector
    const detectorTriggered = detectionResult.arrhythmiaStatus === 'irregular';
    const secondaryDetection = consecutiveAbnormalBeatsRef.current >= 3 && 
                              canTriggerNewDetection &&
                              isVariationAbnormal;
    
    let newIsArrhythmia = false;
    let newArrhythmiaData = null;
    
    if (detectorTriggered || secondaryDetection) {
      newIsArrhythmia = true;
      newArrhythmiaData = {
        timestamp: now,
        rmssd,
        rrVariation
      };
      
      // Only increment count if we're fully triggering a new detection
      if (canTriggerNewDetection) {
        setArrhythmiaCount(prev => prev + 1);
        lastDetectionTimeRef.current = now;
      }
    }
    
    // Update state
    setIsArrhythmia(newIsArrhythmia);
    setArrhythmiaData(detectionResult.lastArrhythmiaData || newArrhythmiaData);
    setArrhythmiaStatus(detectionResult.arrhythmiaStatus);
    
    return {
      isArrhythmia: newIsArrhythmia,
      arrhythmiaStatus: detectionResult.arrhythmiaStatus,
      count: detectionResult.count,
      data: detectionResult.lastArrhythmiaData || newArrhythmiaData
    };
  }, [arrhythmiaCount]);
  
  /**
   * Reset the arrhythmia detector
   */
  const reset = useCallback(() => {
    detectorRef.current.reset();
    rrIntervalsRef.current = [];
    consecutiveAbnormalBeatsRef.current = 0;
    lastDetectionTimeRef.current = 0;
    setIsArrhythmia(false);
    setArrhythmiaData(null);
    setArrhythmiaCount(0);
    setArrhythmiaStatus('normal');
  }, []);
  
  /**
   * Get current arrhythmia count
   */
  const getArrhythmiaCount = useCallback(() => {
    return detectorRef.current.getArrhythmiaCount();
  }, []);
  
  return {
    isArrhythmia,
    arrhythmiaData,
    arrhythmiaCount,
    arrhythmiaStatus,
    detectArrhythmia,
    reset,
    getArrhythmiaCount
  };
}
