
/**
 * Core module exports
 * Provides centralized access to all core functionality
 */

// Configuration
export { VitalSignsConfig } from './config/VitalSignsConfig';

// Types
export type { HeartBeatResult, ProcessedSignal, RRIntervalData } from './types';

// Adapters
export { ArrhythmiaAdapter } from './adapters/ArrhythmiaAdapter';
export { BloodPressureAdapter } from './adapters/BloodPressureAdapter';

// Unified detectors
export { ArrhythmiaDetectorUnified } from './analysis/ArrhythmiaDetectorUnified';

// Result types
export type { ArrhythmiaResult, ArrhythmiaProcessingResult } from './analysis/ArrhythmiaDetectorUnified';
