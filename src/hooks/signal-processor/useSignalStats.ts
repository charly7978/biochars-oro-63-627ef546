
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */
import { useState } from 'react';
import { SignalStats } from './types';

/**
 * Hook for managing signal statistics
 */
export const useSignalStats = () => {
  const [signalStats, setSignalStats] = useState<SignalStats>({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0
  });

  /**
   * Reset signal statistics
   */
  const resetStats = () => {
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    });
  };

  /**
   * Update signal statistics with a new value
   */
  const updateStats = (value: number) => {
    setSignalStats(prev => {
      return {
        minValue: Math.min(prev.minValue, value),
        maxValue: Math.max(prev.maxValue, value),
        avgValue: (prev.avgValue * prev.totalValues + value) / (prev.totalValues + 1),
        totalValues: prev.totalValues + 1
      };
    });
  };

  return {
    signalStats,
    resetStats,
    updateStats
  };
};
