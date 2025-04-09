
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Central export for vital signs module
 */

// Export the VitalSignsProcessor
export { VitalSignsProcessor } from './VitalSignsProcessor';

// Create a type definition for VitalSignsResult
export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  lastArrhythmiaData?: any;
  confidence?: {
    glucose: number;
    lipids: number;
    overall: number;
  };
}

// Export the traditional processor
export { ModularVitalSignsProcessor } from './ModularVitalSignsProcessor';

// Export the precision processor with advanced features
export { PrecisionVitalSignsProcessor } from './PrecisionVitalSignsProcessor'; 
export type { PrecisionVitalSignsResult } from './PrecisionVitalSignsProcessor';

// Export hybrid processor with neural network enhancements
export { HybridVitalSignsProcessor } from './HybridVitalSignsProcessor';
export type { HybridProcessingOptions } from './HybridVitalSignsProcessor';

// Export calibration module
export { CalibrationManager } from './calibration/CalibrationManager';
export type { CalibrationReference, CalibrationFactors } from './calibration/CalibrationManager';

// Export cross-validation module
export { CrossValidator } from './correlation/CrossValidator';
export type { MeasurementsToValidate, ValidationResult } from './correlation/CrossValidator';

// Export environmental adjuster
export { EnvironmentalAdjuster } from './environment/EnvironmentalAdjuster';
export type { EnvironmentalConditions, AdjustmentFactors } from './environment/EnvironmentalAdjuster';

// Export specialized processors
export * from './specialized/BaseVitalSignProcessor';
export * from './specialized/GlucoseProcessor';
export * from './specialized/LipidsProcessor';
export * from './specialized/BloodPressureProcessor';
export * from './specialized/SpO2Processor';
export * from './specialized/CardiacProcessor';

// Export shared signal utils and arrhythmia types
export * from './arrhythmia/types';
export * from './shared-signal-utils';

// Export specific utility functions
export { 
  // Export signal processing core functions
  calculateAC,
  calculateDC,
  calculateStandardDeviation,
  calculateEMA,
  normalizeValue,
  
  // Export peak detection functions
  findPeaksAndValleys,
  calculateAmplitude,
  
  // Export filter functions
  applySMAFilter,
  amplifySignal,
  
  // Export perfusion functions
  calculatePerfusionIndex
} from './utils';

// Export the blood pressure processor for direct access
export { BloodPressureProcessor } from './blood-pressure-processor';
