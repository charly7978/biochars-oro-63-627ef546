
/**
 * Blood Pressure Smoother
 * Handles smoothing and averaging of blood pressure readings
 */
export class BPSmoother {
  /**
   * Calculate smoothed blood pressure values using exponential weighting
   */
  public static calculateSmoothedValues(
    systolicBuffer: number[], 
    diastolicBuffer: number[],
    alpha: number
  ): { 
    finalSystolic: number; 
    finalDiastolic: number; 
  } {
    let finalSystolic = 0;
    let finalDiastolic = 0;
    let weightSum = 0;

    for (let i = 0; i < systolicBuffer.length; i++) {
      const weight = Math.pow(alpha, systolicBuffer.length - 1 - i);
      finalSystolic += systolicBuffer[i] * weight;
      finalDiastolic += diastolicBuffer[i] * weight;
      weightSum += weight;
    }

    if (weightSum > 0) {
      finalSystolic = finalSystolic / weightSum;
      finalDiastolic = finalDiastolic / weightSum;
    } else {
      finalSystolic = 120;
      finalDiastolic = 80;
    }

    return { finalSystolic, finalDiastolic };
  }
}
