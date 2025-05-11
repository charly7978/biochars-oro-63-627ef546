
import { useState, useEffect, useCallback } from 'react';
import ArrhythmiaDetectionService from '@/services/arrhythmia';
import { ArrhythmiaStatus } from '@/services/arrhythmia/types';
import { formatArrhythmiaWindowsForDisplay } from '@/services/arrhythmia/utils';
import { ArrhythmiaWindow } from '@/types/arrhythmia';

/**
 * Hook to handle the visualization aspects of arrhythmia detection
 */
export function useArrhythmiaVisualization() {
  const [arrhythmiaState, setArrhythmiaState] = useState<{
    isArrhythmia: boolean;
    type: ArrhythmiaStatus;
    lastDetected: Date | null;
    windowData: any[];
  }>({
    isArrhythmia: false,
    type: 'normal',
    lastDetected: null,
    windowData: []
  });

  // Status change listener
  const handleArrhythmiaStatusChange = useCallback((status: ArrhythmiaStatus) => {
    const isArrhythmia = status !== 'normal';
    setArrhythmiaState(prev => ({
      ...prev,
      isArrhythmia,
      type: status,
      lastDetected: isArrhythmia ? new Date() : prev.lastDetected,
    }));
  }, []);

  // Register status change listener
  useEffect(() => {
    ArrhythmiaDetectionService.addArrhythmiaListener(handleArrhythmiaStatusChange);
    
    return () => {
      ArrhythmiaDetectionService.removeArrhythmiaListener(handleArrhythmiaStatusChange);
    };
  }, [handleArrhythmiaStatusChange]);

  // Update window data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const windows = ArrhythmiaDetectionService.getArrhythmiaWindows();
      
      // Only update state if there's a change
      setArrhythmiaState(prev => {
        if (prev.windowData.length !== windows.length) {
          return { ...prev, windowData: [...windows] };
        }
        return prev;
      });
    }, 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  /**
   * Get formatted information about the current arrhythmia
   */
  const getArrhythmiaInfo = useCallback(() => {
    if (!arrhythmiaState.isArrhythmia) {
      return {
        message: 'Ritmo Normal',
        severity: 'normal',
        color: '#4CAF50',
        details: 'Ninguna arritmia detectada'
      };
    }

    switch (arrhythmiaState.type) {
      case 'bradycardia':
        return {
          message: 'Bradicardia',
          severity: 'moderate',
          color: '#FF9800',
          details: 'Frecuencia cardíaca anormalmente lenta'
        };
      case 'tachycardia':
        return {
          message: 'Taquicardia',
          severity: 'moderate',
          color: '#FF5722',
          details: 'Frecuencia cardíaca anormalmente elevada'
        };
      case 'possible-afib':
        return {
          message: 'Posible Fibrilación',
          severity: 'severe',
          color: '#F44336',
          details: 'Ritmo irregular detectado - Variaciones significativas'
        };
      case 'bigeminy':
        return {
          message: 'Bigeminismo',
          severity: 'moderate',
          color: '#FF9800',
          details: 'Patrón de latidos prematuros alternados'
        };
      case 'possible-arrhythmia':
      default:
        return {
          message: 'Arritmia Posible',
          severity: 'moderate',
          color: '#FFC107',
          details: 'Irregularidad detectada'
        };
    }
  }, [arrhythmiaState.isArrhythmia, arrhythmiaState.type]);

  /**
   * Reset arrhythmia visualization state
   */
  const resetArrhythmiaState = useCallback(() => {
    setArrhythmiaState({
      isArrhythmia: false,
      type: 'normal',
      lastDetected: null,
      windowData: []
    });
  }, []);

  /**
   * Process arrhythmia status from detected values
   */
  const processArrhythmiaStatus = useCallback((
    status: string, 
    data: { timestamp: number; rmssd: number; rrVariation: number; } | null
  ): boolean => {
    // If no data, can't process
    if (!data) return false;
    
    // Check if this is a new arrhythmia event
    const isNewEvent = status !== 'normal' && status.includes('ARRHYTHMIA DETECTED');
    return isNewEvent;
  }, []);

  /**
   * Register a notification for arrhythmia detection
   */
  const registerArrhythmiaNotification = useCallback(() => {
    // Implementation would depend on your notification system
    console.log('Arrhythmia notification registered at', new Date());
    return true;
  }, []);

  /**
   * Add an arrhythmia window for visualization
   */
  const addArrhythmiaWindow = useCallback((
    timestamp: number,
    duration: number,
    status: ArrhythmiaStatus,
    intervals: number[],
    probability: number,
    details: Record<string, any> = {}
  ) => {
    ArrhythmiaDetectionService.updateStatus(status, probability, {
      ...details,
      intervals,
      duration
    });
  }, []);

  /**
   * Clear all arrhythmia windows
   */
  const clearArrhythmiaWindows = useCallback(() => {
    ArrhythmiaDetectionService.clear();
    resetArrhythmiaState();
  }, [resetArrhythmiaState]);

  // Get formatted windows for display
  const formattedWindows = formatArrhythmiaWindowsForDisplay(arrhythmiaState.windowData);

  // Ensure proper typing for arrhythmiaWindows
  const arrhythmiaWindows = formattedWindows as ArrhythmiaWindow[];

  return {
    arrhythmiaState,
    getArrhythmiaInfo,
    resetArrhythmiaState,
    arrhythmiaWindowData: arrhythmiaState.windowData,
    // Return properly implemented methods
    arrhythmiaWindows,
    addArrhythmiaWindow,
    clearArrhythmiaWindows,
    processArrhythmiaStatus,
    registerArrhythmiaNotification
  };
}
