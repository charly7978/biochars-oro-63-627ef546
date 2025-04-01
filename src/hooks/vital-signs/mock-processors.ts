
/**
 * Mock processors for vital signs that aren't implemented yet
 * These are necessary to fix TypeScript errors
 */

// Mock oxygen saturation processor
export const useOxygenSaturationProcessor = () => {
  return {
    processSignal: () => ({ spO2: 98, confidence: 0.8 }),
    reset: () => {}
  };
};

// Mock respiration rate processor
export const useRespirationRateProcessor = () => {
  return {
    processSignal: () => ({ rpm: 16, confidence: 0.7 }),
    reset: () => {}
  };
};

// Mock blood pressure processor
export const useBloodPressureProcessor = () => {
  return {
    processSignal: () => ({ systolic: 120, diastolic: 80, confidence: 0.6 }),
    reset: () => {}
  };
};

// Mock stress level processor
export const useStressLevelProcessor = () => {
  return {
    processSignal: () => ({ level: 25, confidence: 0.5 }),
    reset: () => {}
  };
};
