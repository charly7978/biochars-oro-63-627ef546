
import { useState, useEffect } from 'react';
import { useSignalProcessor } from './useSignalProcessor';

/**
 * Hook para acceder a los datos PPG en tiempo real
 */
export const usePPGData = () => {
  const [ppgValues, setPpgValues] = useState<number[]>([]);
  const { lastSignal, isProcessing } = useSignalProcessor();

  useEffect(() => {
    if (lastSignal && lastSignal.fingerDetected) {
      setPpgValues(prev => {
        const newValues = [...prev, lastSignal.filteredValue];
        // Mantener un historial razonable
        if (newValues.length > 600) {
          return newValues.slice(-600);
        }
        return newValues;
      });
    }
  }, [lastSignal]);

  return { ppgValues, isProcessing };
};
