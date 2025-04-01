
/**
 * Utility functions for blood pressure processing
 */

/**
 * Calculate Mean Arterial Pressure (MAP)
 * @param systolic Systolic blood pressure
 * @param diastolic Diastolic blood pressure
 * @returns Mean Arterial Pressure
 */
export function calculateMAP(systolic: number, diastolic: number): number {
  return Math.round(diastolic + (systolic - diastolic) / 3);
}

/**
 * Format blood pressure as a string
 * @param systolic Systolic blood pressure
 * @param diastolic Diastolic blood pressure
 * @returns Formatted blood pressure string (e.g., "120/80")
 */
export function formatBloodPressure(systolic: number, diastolic: number): string {
  if (systolic <= 0 || diastolic <= 0) {
    return "--/--";
  }
  return `${systolic}/${diastolic}`;
}

/**
 * Validate if blood pressure values are within physiological ranges
 * @param systolic Systolic blood pressure
 * @param diastolic Diastolic blood pressure
 * @returns Whether the blood pressure values are valid
 */
export function validateBloodPressure(systolic: number, diastolic: number): boolean {
  // Check range validity
  if (systolic < 70 || systolic > 220) return false;
  if (diastolic < 40 || diastolic > 130) return false;
  
  // Systolic should be higher than diastolic
  if (systolic <= diastolic) return false;
  
  // Pulse pressure (difference) should be reasonable
  const pulsePressure = systolic - diastolic;
  if (pulsePressure < 20 || pulsePressure > 100) return false;
  
  return true;
}

/**
 * Categorize blood pressure reading
 * @param systolic Systolic blood pressure
 * @param diastolic Diastolic blood pressure
 * @returns Category of blood pressure
 */
export function categorizeBloodPressure(systolic: number, diastolic: number): string {
  if (systolic < 90 || diastolic < 60) return "Low";
  if (systolic < 120 && diastolic < 80) return "Normal";
  if (systolic < 130 && diastolic < 80) return "Elevated";
  if (systolic < 140 || diastolic < 90) return "Stage 1";
  if (systolic < 180 || diastolic < 120) return "Stage 2";
  return "Crisis";
}
