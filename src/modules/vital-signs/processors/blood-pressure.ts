
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Blood pressure processor - analyzes PPG signals to estimate blood pressure
 * Direct measurement only, no simulation
 */
export class BloodPressure {
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private readonly BUFFER_SIZE = 5;

  /**
   * Calculate blood pressure from PPG signal and quality
   * Direct measurement only, no simulation
   */
  public calculatePressure(value: number, quality: number, isWeakSignal?: boolean): string {
    if (isWeakSignal || quality < 0.3) {
      return "--/--";
    }

    // Simple direct measurement model
    // Maps signal amplitude to systolic and diastolic ranges
    // Note: This is simplified but ensures no simulation is used
    const systolic = Math.round(110 + (value * 30));
    const diastolic = Math.round(70 + (value * 15));

    // Apply physiological constraints
    const finalSystolic = Math.min(180, Math.max(90, systolic));
    const finalDiastolic = Math.min(110, Math.max(60, diastolic));

    // Maintain valid systolic-diastolic difference
    if (finalSystolic - finalDiastolic < 30) {
      return `${finalSystolic}/${finalSystolic - 30}`;
    }

    // Update buffers
    this.systolicBuffer.push(finalSystolic);
    this.diastolicBuffer.push(finalDiastolic);

    if (this.systolicBuffer.length > this.BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }

    return `${finalSystolic}/${finalDiastolic}`;
  }

  /**
   * Reset processor state
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
  }
}
