
/**
 * Blood Pressure Calculator
 * Handles conversion of PTT and amplitude data to blood pressure values
 */
export class BPCalculator {
  /**
   * Calculate blood pressure values from normalized PTT and amplitude
   */
  public static calculateBPValues(normalizedPTT: number, normalizedAmplitude: number): {
    systolic: number;
    diastolic: number;
  } {
    const pttFactor = (600 - normalizedPTT) * 0.08;
    const ampFactor = normalizedAmplitude * 0.3;
    
    let instantSystolic = 120 + pttFactor + ampFactor;
    let instantDiastolic = 80 + (pttFactor * 0.5) + (ampFactor * 0.2);

    // Limit to physiological ranges
    instantSystolic = Math.max(90, Math.min(180, instantSystolic));
    instantDiastolic = Math.max(60, Math.min(110, instantDiastolic));
    
    return { 
      systolic: instantSystolic, 
      diastolic: instantDiastolic 
    };
  }
  
  /**
   * Ensure the pressure differential is physiologically plausible
   */
  public static normalizePressureDifferential(systolic: number, diastolic: number): {
    systolic: number;
    diastolic: number;
  } {
    const differential = systolic - diastolic;
    
    if (differential < 20) {
      return {
        systolic,
        diastolic: systolic - 20
      };
    } else if (differential > 80) {
      return {
        systolic,
        diastolic: systolic - 80
      };
    }
    
    return { systolic, diastolic };
  }
}
