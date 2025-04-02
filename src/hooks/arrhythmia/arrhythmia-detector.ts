
import { useState, useRef, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import { RRAnalysisResult } from './types';

/**
 * Hook for arrhythmia detection based on RR intervals
 */
export function useArrhythmiaDetector() {
  // State for arrhythmia detection
  const lastRRIntervalsRef = useRef<number[]>([]);
  const lastIsArrhythmiaRef = useRef<boolean>(false);
  const currentBeatIsArrhythmiaRef = useRef<boolean>(false);
  const heartRateVariabilityRef = useRef<number>(0);
  const stabilityCounterRef = useRef<number>(0);
  const arrhythmiaModelRef = useRef<tf.Sequential | null>(null);
  
  // Initialize arrhythmia detection model
  const initializeModel = useCallback(async () => {
    try {
      if (arrhythmiaModelRef.current) {
        return; // Model already exists
      }
      
      // Create a sequential model using TensorFlow.js
      const model = tf.sequential();
      
      // Add input layer with 8 units (for 8 RR intervals)
      // Fix: Use layers.dense instead of direct "add" on the model
      model.add(tf.layers.dense({
        inputShape: [8], 
        units: 16, 
        activation: 'relu'
      }));
      
      // Add hidden layer
      // Fix: Use layers.dense instead of direct "add" on the model
      model.add(tf.layers.dense({
        units: 8, 
        activation: 'relu'
      }));
      
      // Add output layer (probability of arrhythmia)
      // Fix: Use layers.dense instead of direct "add" on the model
      model.add(tf.layers.dense({
        units: 1, 
        activation: 'sigmoid'
      }));
      
      // Compile the model
      model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });
      
      arrhythmiaModelRef.current = model;
      console.log('Arrhythmia detection model initialized');
    } catch (error) {
      console.error('Error initializing arrhythmia detection model:', error);
    }
  }, []);
  
  // Detect arrhythmia based on RR intervals
  const detectArrhythmia = useCallback((rrIntervals: number[]): RRAnalysisResult => {
    if (rrIntervals.length < 2) {
      return {
        isArrhythmia: false,
        rmssd: 0,
        rrVariation: 0,
        timestamp: Date.now()
      };
    }
    
    try {
      // Calculate RR interval statistics
      const mean = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
      
      // Calculate RR standard deviation (RRSD)
      const squaredDifferences = rrIntervals.map(rr => Math.pow(rr - mean, 2));
      const variance = squaredDifferences.reduce((a, b) => a + b, 0) / rrIntervals.length;
      const rmssd = Math.sqrt(variance);
      
      // Calculate irregularity score (normalized RRSD)
      const irregularityScore = rmssd / mean;
      heartRateVariabilityRef.current = irregularityScore;
      
      // Simple threshold-based detection
      // More irregular = higher chance of arrhythmia
      const isIrregular = irregularityScore > 0.2;
      
      // Check for very long or very short intervals
      const hasAbnormalIntervals = rrIntervals.some(rr => 
        rr < 400 || // Very fast: > 150 BPM
        rr > 1200   // Very slow: < 50 BPM
      );
      
      // Combine factors for final decision
      const isArrhythmia = isIrregular || hasAbnormalIntervals;
      
      // Update arrhythmia stability counter
      if (isArrhythmia === lastIsArrhythmiaRef.current) {
        stabilityCounterRef.current++;
      } else {
        stabilityCounterRef.current = 0;
      }
      
      lastIsArrhythmiaRef.current = isArrhythmia;
      
      return {
        isArrhythmia,
        rmssd,
        rrVariation: irregularityScore,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error in arrhythmia detection:', error);
      return {
        isArrhythmia: false,
        rmssd: 0,
        rrVariation: 0,
        timestamp: Date.now()
      };
    }
  }, []);
  
  // Reset all state
  const reset = useCallback(() => {
    lastRRIntervalsRef.current = [];
    lastIsArrhythmiaRef.current = false;
    currentBeatIsArrhythmiaRef.current = false;
    heartRateVariabilityRef.current = 0;
    stabilityCounterRef.current = 0;
  }, []);
  
  // Initialize on first call
  useCallback(() => {
    initializeModel();
  }, [initializeModel])();
  
  return {
    detectArrhythmia,
    reset,
    lastRRIntervalsRef,
    lastIsArrhythmiaRef,
    currentBeatIsArrhythmiaRef,
    heartRateVariabilityRef,
    stabilityCounterRef,
    arrhythmiaModelRef
  };
}
