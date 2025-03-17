
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 * 
 * Bridge adapter to connect the legacy VitalSignsProcessor.js with the new TypeScript architecture
 * This facilitates a smooth transition to the new modular structure
 */

import { LegacyVitalSignsProcessor } from './LegacyVitalSignsProcessor';
import { VitalSignsResult } from '../vital-signs/VitalSignsProcessor';
import { SignalValidator } from '../signal-validation/SignalValidator';

/**
 * Factory function that returns an appropriate processor implementation
 */
export function createVitalSignsProcessor(useLegacy: boolean = false): {
  processSignal: (ppgValue: number, rrData?: { intervals: number[]; lastPeakTime: number | null }) => VitalSignsResult;
  reset: () => void;
} {
  const legacyProcessor = new LegacyVitalSignsProcessor();
  const signalValidator = new SignalValidator();
  
  return {
    processSignal: (ppgValue: number, rrData?: { intervals: number[]; lastPeakTime: number | null }) => {
      // Validate signal before processing
      const validationResult = signalValidator.validateSignalQuality(ppgValue);
      if (!validationResult.isValid) {
        // Return empty result for invalid signals
        return {
          spo2: 0,
          pressure: "--/--",
          arrhythmiaStatus: "--",
          glucose: 0,
          lipids: {
            totalCholesterol: 0,
            triglycerides: 0
          }
        };
      }
      
      return legacyProcessor.processSignal(ppgValue, rrData);
    },
    reset: () => {
      legacyProcessor.reset();
      signalValidator.reset();
    }
  };
}
