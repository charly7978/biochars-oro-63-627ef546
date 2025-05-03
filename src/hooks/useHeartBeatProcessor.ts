/**
 * Hook for processing PPG signals and extracting heart rate and other vital signs
 * This hook provides real-time analysis of photoplethysmography data from camera
 * 
 * IMPORTANT: This implementation uses ONLY real data processing, NOT simulation.
 * Any appearance of Math.random() or similar functions is strictly prohibited.
 */

import { useState, useEffect, useRef } from 'react';
import { useCallback } from 'react';
import { getModel } from '../core/neural/ModelRegistry';
import { HeartRateNeuralModel } from '../core/neural/HeartRateModel';
import { SpO2NeuralModel } from '../core/neural/SpO2Model';
import { usePPGSignalProcessor } from './usePPGSignalProcessor';
import { useArrhythmiaDetection } from './useArrhythmiaDetection';
import { ArrhythmiaDetectionResult } from '../services/arrhythmia/types';

// Types for the hook
export interface HeartBeatData {
  heartRate: number;
  confidence: number;
  bpmHistory: number[];
  rrIntervals: number[];  // in milliseconds
  signalQuality: number; // 0-100
  arrhythmiaData?: ArrhythmiaDetectionResult;
  spo2?: number;
  perfusionIndex?: number;
}

export interface HeartBeatOptions {
  windowSize?: number;
  minQuality?: number;
  useLowPassFilter?: boolean;
  useHighPassFilter?: boolean;
}

/**
 * Hook for processing photoplethysmography (PPG) signals to extract vital signs
 */
export function useHeartBeatProcessor(options: HeartBeatOptions = {}) {
  // Default options
  const defaultOptions = {
    windowSize: 150,
    minQuality: 50,
    useLowPassFilter: true,
    useHighPassFilter: true,
  };

  const mergedOptions = { ...defaultOptions, ...options };
  
  // State for heart rate data
  const [heartBeatData, setHeartBeatData] = useState<HeartBeatData>({
    heartRate: 0,
    confidence: 0,
    bpmHistory: [],
    rrIntervals: [],
    signalQuality: 0,
  });
  
  // Refs to track data between renders
  const dataRef = useRef({
    bpmHistory: [] as number[],
    rrIntervals: [] as number[],
    lastPeakTime: 0,
    peakCount: 0,
    valleyCount: 0,
    signalQualityHistory: [] as number[],
  });
  
  // Use PPG signal processor
  const { 
    processFrame, 
    filteredSignal, 
    rawSignal, 
    signalQuality,
    reset: resetPPGProcessor
  } = usePPGSignalProcessor({
    windowSize: mergedOptions.windowSize,
    useLowPassFilter: mergedOptions.useLowPassFilter,
    useHighPassFilter: mergedOptions.useHighPassFilter
  });
  
  // Use arrhythmia detection
  const { 
    processHeartbeat, 
    arrhythmiaResult,
    reset: resetArrhythmia
  } = useArrhythmiaDetection();

  /**
   * Main function to process a new video frame
   */
  const processVideoFrame = useCallback(async (
    imageData: ImageData | Uint8Array | Uint8ClampedArray,
    width: number,
    height: number
  ): Promise<HeartBeatData> => {
    try {
      // Process the frame with PPG signal processor
      const result = await processFrame(imageData, width, height);
      
      if (!result || result.quality < mergedOptions.minQuality) {
        // Low quality data, return current state
        return heartBeatData;
      }
      
      // Extract data from PPG processor
      const { peaks, quality } = result;
      
      // Process any new peaks detected
      let newIntervals: number[] = [];
      if (peaks && peaks.length > 0) {
        const now = Date.now();
        
        for (const peak of peaks) {
          if (dataRef.current.lastPeakTime > 0) {
            const interval = now - dataRef.current.lastPeakTime;
            
            // Only accept physiologically plausible intervals (30-240 BPM)
            if (interval >= 250 && interval <= 2000) {
              newIntervals.push(interval);
              
              // Add to RR intervals history
              dataRef.current.rrIntervals.push(interval);
              // Keep only recent history
              if (dataRef.current.rrIntervals.length > 20) {
                dataRef.current.rrIntervals.shift();
              }
              
              // Calculate heart rate from this interval
              const bpm = Math.round(60000 / interval);
              
              // Add to BPM history if value is physiologically plausible
              if (bpm >= 30 && bpm <= 240) {
                dataRef.current.bpmHistory.push(bpm);
                // Keep only recent history
                if (dataRef.current.bpmHistory.length > 10) {
                  dataRef.current.bpmHistory.shift();
                }
              }
            }
          }
          
          dataRef.current.lastPeakTime = now;
          dataRef.current.peakCount++;
        }
      }
      
      // Track signal quality
      dataRef.current.signalQualityHistory.push(quality);
      if (dataRef.current.signalQualityHistory.length > 10) {
        dataRef.current.signalQualityHistory.shift();
      }
      
      // Calculate average quality
      const avgQuality = dataRef.current.signalQualityHistory.reduce((sum, q) => sum + q, 0) / 
                         dataRef.current.signalQualityHistory.length;
      
      // Calculate heart rate based on recent history (more stable)
      let heartRate = 0;
      let confidence = 0;
      
      if (dataRef.current.bpmHistory.length > 0) {
        // Calculate average, excluding outliers
        const sortedBpm = [...dataRef.current.bpmHistory].sort((a, b) => a - b);
        const validBpm = sortedBpm.slice(
          Math.floor(sortedBpm.length * 0.2),
          Math.ceil(sortedBpm.length * 0.8)
        );
        
        if (validBpm.length > 0) {
          heartRate = Math.round(validBpm.reduce((sum, bpm) => sum + bpm, 0) / validBpm.length);
          
          // Calculate confidence based on consistency of measurements
          const maxDev = Math.max(...validBpm) - Math.min(...validBpm);
          confidence = Math.max(0, Math.min(1, 1 - (maxDev / 30)));
        }
      }
      
      // Process through neural models if available
      try {
        if (filteredSignal && filteredSignal.length >= 100 && quality > 70) {
          // Get heart rate from neural model
          const heartRateModel = getModel<HeartRateNeuralModel>('heartRate');
          if (heartRateModel && heartRateModel.getModelInfo().isLoaded) {
            const neuralBpm = await heartRateModel.predict(filteredSignal.slice(-100));
            
            if (neuralBpm && neuralBpm[0] > 0) {
              // Average with current heart rate for stability
              heartRate = heartRate > 0 ? 
                Math.round((heartRate * 0.7) + (neuralBpm[0] * 0.3)) : 
                Math.round(neuralBpm[0]);
                
              // Boost confidence
              confidence = Math.min(1, confidence + 0.2);
            }
          }
          
          // Get SpO2 from neural model if available
          const spo2Model = getModel<SpO2NeuralModel>('spo2');
          let spo2Value;
          let perfusionIndex = 0;
          
          if (spo2Model && spo2Model.getModelInfo().isLoaded && filteredSignal.length >= 300) {
            const neuralSpo2 = await spo2Model.predict(filteredSignal.slice(-300));
            if (neuralSpo2 && neuralSpo2[0] > 0) {
              spo2Value = neuralSpo2[0];
            }
            
            // Estimate perfusion index from signal metrics
            const signalMean = filteredSignal.reduce((sum, val) => sum + val, 0) / filteredSignal.length;
            const signalMin = Math.min(...filteredSignal);
            const signalMax = Math.max(...filteredSignal);
            
            if (signalMean !== 0) {
              perfusionIndex = (signalMax - signalMin) / Math.abs(signalMean) * 100;
              // Scale to typical range
              perfusionIndex = Math.min(20, Math.max(0.1, perfusionIndex * 0.5));
            }
          }
          
          // Process arrhythmia detection
          let arrhythmiaData;
          if (newIntervals.length > 0) {
            for (const interval of newIntervals) {
              const result = processHeartbeat(interval, quality);
              arrhythmiaData = result;
            }
          }
          
          // Update state
          const updatedData: HeartBeatData = {
            heartRate,
            confidence,
            bpmHistory: dataRef.current.bpmHistory,
            rrIntervals: dataRef.current.rrIntervals,
            signalQuality: avgQuality,
            arrhythmiaData: arrhythmiaData || heartBeatData.arrhythmiaData,
            spo2: spo2Value,
            perfusionIndex
          };
          
          setHeartBeatData(updatedData);
          return updatedData;
        }
      } catch (error) {
        console.error('Error in neural processing:', error);
      }
      
      // Update state with basic data
      const updatedData: HeartBeatData = {
        heartRate,
        confidence,
        bpmHistory: dataRef.current.bpmHistory,
        rrIntervals: dataRef.current.rrIntervals,
        signalQuality: avgQuality,
        arrhythmiaData: heartBeatData.arrhythmiaData
      };
      
      setHeartBeatData(updatedData);
      return updatedData;
      
    } catch (error) {
      console.error('Error in heart beat processor:', error);
      return heartBeatData;
    }
  }, [processFrame, filteredSignal, rawSignal, heartBeatData, processHeartbeat, mergedOptions.minQuality]);

  /**
   * Reset all data and state
   */
  const reset = useCallback(() => {
    dataRef.current = {
      bpmHistory: [],
      rrIntervals: [],
      lastPeakTime: 0,
      peakCount: 0,
      valleyCount: 0,
      signalQualityHistory: []
    };
    
    setHeartBeatData({
      heartRate: 0,
      confidence: 0,
      bpmHistory: [],
      rrIntervals: [],
      signalQuality: 0
    });
    
    // Reset other processors
    resetPPGProcessor();
    resetArrhythmia();
    
  }, [resetPPGProcessor, resetArrhythmia]);

  return {
    processVideoFrame,
    heartBeatData,
    reset,
    rawSignal,
    filteredSignal,
    signalQuality
  };
}
