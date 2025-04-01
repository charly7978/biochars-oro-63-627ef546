
/**
 * Utility functions for blood pressure calculations
 */

/**
 * Calculate Mean Arterial Pressure (MAP) from systolic and diastolic values
 */
export function calculateMAP(systolic: number, diastolic: number): number {
  return Math.round(diastolic + (systolic - diastolic) / 3);
}

/**
 * Format blood pressure as a string in systolic/diastolic format
 */
export function formatBloodPressure(systolic: number, diastolic: number): string {
  if (systolic <= 0 || diastolic <= 0) {
    return "--/--";
  }
  return `${systolic}/${diastolic}`;
}

/**
 * Validate blood pressure values are within physiological range
 */
export function validateBloodPressure(systolic: number, diastolic: number): boolean {
  // Basic physiological validation
  if (systolic < 70 || systolic > 200) return false;
  if (diastolic < 40 || diastolic > 120) return false;
  if (systolic <= diastolic) return false;
  
  // Pulse pressure should be reasonable
  const pulsePressure = systolic - diastolic;
  if (pulsePressure < 20 || pulsePressure > 100) return false;
  
  return true;
}
