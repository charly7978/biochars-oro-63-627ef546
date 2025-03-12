
import { calculateAC, calculateDC } from './utils';

export class SpO2Processor {
  private readonly SPO2_CALIBRATION_FACTOR = 1.05; 
  private readonly PERFUSION_INDEX_THRESHOLD = 0.06; // Reduced for fingertip signals
  private readonly SPO2_BUFFER_SIZE = 15; 
  private spo2Buffer: number[] = [];
  private perfusionBuffer: number[] = []; 
  private readonly PERFUSION_BUFFER_SIZE = 10;
  
  // Normalized factors for fingertip measurements
  private readonly FINGER_AC_NORMALIZATION = 1.25; // Increased for fingertips
  private readonly FINGER_DC_NORMALIZATION = 0.90; // Adjusted for fingertips
  private readonly MIN_VALID_PERFUSION_INDEX = 0.03; // Lower minimum for fingertips

  /**
   * Calculates the oxygen saturation (SpO2) from PPG values
   * with enhanced false detection prevention and fingertip optimization
   */
  public calculateSpO2(values: number[]): number {
    // Require fewer values for fingertip analysis
    if (values.length < 35) { // Reduced requirement
      if (this.spo2Buffer.length > 0) {
        const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
        return Math.max(0, lastValid - 1);
      }
      return 0;
    }

    const dc = calculateDC(values) * this.FINGER_DC_NORMALIZATION;
    if (dc === 0) {
      if (this.spo2Buffer.length > 0) {
        const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
        return Math.max(0, lastValid - 1);
      }
      return 0;
    }

    const ac = calculateAC(values) * this.FINGER_AC_NORMALIZATION;
    
    const perfusionIndex = ac / dc;
    
    // Añadir al buffer de perfusión
    this.perfusionBuffer.push(perfusionIndex);
    if (this.perfusionBuffer.length > this.PERFUSION_BUFFER_SIZE) {
      this.perfusionBuffer.shift();
    }
    
    // Calcular promedio de perfusión para estabilidad
    const avgPerfusion = this.perfusionBuffer.reduce((sum, val) => sum + val, 0) / 
                         this.perfusionBuffer.length;
    
    // More permissive adaptive threshold for fingertips
    const adaptiveThreshold = Math.max(
      this.MIN_VALID_PERFUSION_INDEX,
      this.PERFUSION_INDEX_THRESHOLD * (avgPerfusion > 0.1 ? 0.7 : 0.9) // More permissive
    );
    
    // Verificar si la perfusión es suficiente para una medición válida
    if (avgPerfusion < adaptiveThreshold) {
      // Señal insuficiente o posible falso positivo
      if (this.spo2Buffer.length > 0) {
        // Degradación gradual de la última medición válida
        const lastValid = this.spo2Buffer[this.spo2Buffer.length - 1];
        return Math.max(0, lastValid - 2);
      }
      return 0;
    }

    // Calcular SpO2 usando ratio R
    const R = (ac / dc) / this.SPO2_CALIBRATION_FACTOR;
    
    // Algoritmo de cálculo de SpO2 para fingertips
    let spO2 = 0;
    
    if (R <= 0.4) {
      spO2 = 100;
    } else if (R < 1.0) {
      // Ecuación de calibración no lineal para rango normal
      spO2 = Math.round(110 - (25 * R));
    } else {
      // Rango de hipoxemia (menos común)
      spO2 = Math.round(100 - (20 * R));
    }
    
    // Ajustes basados en perfusión más permisivos
    if (perfusionIndex > 0.12) { // Reduced threshold
      spO2 = Math.min(99, spO2 + 1);
    } else if (perfusionIndex < 0.05) { // Reduced threshold
      spO2 = Math.max(0, spO2 - 1);
    }

    // Límites fisiológicos
    spO2 = Math.min(99, Math.max(70, spO2));

    // Añadir al buffer para estabilidad
    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }

    // Calcular valor final con ponderación (valores recientes tienen más peso)
    if (this.spo2Buffer.length > 0) {
      let weightedSum = 0;
      let weightSum = 0;
      
      for (let i = 0; i < this.spo2Buffer.length; i++) {
        const weight = 1 + (i * 0.1); // Valores más recientes tienen más peso
        weightedSum += this.spo2Buffer[i] * weight;
        weightSum += weight;
      }
      
      spO2 = Math.round(weightedSum / weightSum);
    }

    return spO2;
  }

  /**
   * Reset the SpO2 processor state
   */
  public reset(): void {
    this.spo2Buffer = [];
    this.perfusionBuffer = [];
  }
}
