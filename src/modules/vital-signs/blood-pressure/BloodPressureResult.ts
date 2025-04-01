
/**
 * Type definitions for blood pressure processing results
 */

/**
 * Result interface for blood pressure measurements
 */
export interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  map: number;
  confidence: number;
}
