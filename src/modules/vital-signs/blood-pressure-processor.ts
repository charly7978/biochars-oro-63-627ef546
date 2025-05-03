import { calculateAmplitude, findPeaksAndValleys, calculateAC } from './shared-signal-utils';
import { calculateDC } from './utils/signal-processing-utils';

export class BloodPressureProcessor {
  // Buffers para almacenar datos históricos reales
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  
  // Seguimiento de medición
  private lastCalculationTime: number = 0;
  
  // Últimos valores calculados para suavizado
  private lastSystolic: number = 0;
  private lastDiastolic: number = 0;
  
  // Umbral de amplitud mínima para confiar en la medición
  private readonly MIN_AMPLITUDE_THRESHOLD = 0.08; // Ajustado para robustez
  
  /**
   * Calcula la presión arterial utilizando ÚNICAMENTE características de señal PPG directas
   * SIN simulación ni valores de referencia - solo medición directa
   */
  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    const now = Date.now();
    // Evitar cálculo demasiado frecuente
    if (now - this.lastCalculationTime < 500 && this.lastSystolic > 0) { 
      return { systolic: this.lastSystolic, diastolic: this.lastDiastolic };
    }
    
    // Necesita suficientes datos
    if (!values || values.length < 50) {
      return { systolic: 0, diastolic: 0 };
    }
    
    // --- Lógica simplificada basada en amplitud (NO VALIDADA CLÍNICAMENTE) ---
    // Esta lógica se comenta y se reemplaza por retorno de 0/0 para indicar
    // que no se puede calcular BP de forma fiable con este método.
    /*
    const recentValues = values.slice(-50); // Usar ventana más grande
    
    // Calcular componentes AC y DC
    const ac = calculateAC(recentValues);
    const dc = calculateDC(recentValues);
    
    if (dc === 0 || ac < this.MIN_AMPLITUDE_THRESHOLD) {
      return { systolic: 0, diastolic: 0 }; // Señal insuficiente
    }
    
    // Calcular índice de perfusión
    const perfusionIndex = ac / dc;
    
    // Encontrar picos y valles para análisis morfológico
    const { peakIndices, valleyIndices } = findPeaksAndValleys(recentValues);
    
    if (peakIndices.length < 3 || valleyIndices.length < 3) {
      return { systolic: 0, diastolic: 0 }; // No hay suficientes características
    }
    
    // Calcular amplitud promedio pico-valle
    let sumAmplitude = 0;
    const count = Math.min(peakIndices.length, valleyIndices.length);
    for (let i = 0; i < count; i++) {
      sumAmplitude += recentValues[peakIndices[i]] - recentValues[valleyIndices[i]];
    }
    const avgAmplitude = sumAmplitude / count;
    
    // Calcular variabilidad de la amplitud
    let sumSqDiff = 0;
    for (let i = 0; i < count; i++) {
      sumSqDiff += Math.pow(recentValues[peakIndices[i]] - recentValues[valleyIndices[i]] - avgAmplitude, 2);
    }
    const amplitudeStdDev = Math.sqrt(sumSqDiff / count);
    const amplitudeCV = amplitudeStdDev / avgAmplitude; // Coeficiente de variación
    
    // Estimación básica (NO USAR EN PRODUCCIÓN SIN VALIDACIÓN EXTENSIVA)
    // Estos factores son heurísticos y no basados en modelos fisiológicos robustos
    let systolicEstimate = 110 + avgAmplitude * 20 + perfusionIndex * 50;
    let diastolicEstimate = 70 + avgAmplitude * 10 + perfusionIndex * 30;
    
    // Ajustar por variabilidad (señales más variables pueden indicar problemas)
    systolicEstimate *= (1 + Math.min(0.1, amplitudeCV * 0.5)); 
    diastolicEstimate *= (1 + Math.min(0.1, amplitudeCV * 0.5));
    
    // Limitar a rangos fisiológicos
    systolicEstimate = Math.max(80, Math.min(180, systolicEstimate));
    diastolicEstimate = Math.max(50, Math.min(120, diastolicEstimate));
    
    // Asegurar que sistólica > diastólica
    if (systolicEstimate <= diastolicEstimate + 10) {
      systolicEstimate = diastolicEstimate + 10;
    }
    */
    
    // Devolver 0/0 ya que la estimación no es fiable
    const systolicEstimate = 0;
    const diastolicEstimate = 0;
    
    // Actualizar buffers con el resultado (aunque sea 0)
    this.systolicBuffer.push(systolicEstimate);
    this.diastolicBuffer.push(diastolicEstimate);
    
    if (this.systolicBuffer.length > 15) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }
    
    // Calcular la mediana del buffer si hay suficientes datos
    let finalSystolic = systolicEstimate;
    let finalDiastolic = diastolicEstimate;
    
    if (this.systolicBuffer.length >= 5) { // Usar mediana si hay al menos 5 valores
      finalSystolic = this.calculateMedian([...this.systolicBuffer]);
      finalDiastolic = this.calculateMedian([...this.diastolicBuffer]);
    }
    
    // Guardar últimos valores calculados (redondeados)
    this.lastSystolic = Math.round(finalSystolic);
    this.lastDiastolic = Math.round(finalDiastolic);
    this.lastCalculationTime = now;
    
    // Devolver 0/0 para indicar falta de medición fiable
    return { systolic: 0, diastolic: 0 };
  }
  
  /**
   * Calcula mediana de un array
   */
  private calculateMedian(sortedArray: number[]): number {
    if (sortedArray.length === 0) return 0;
    
    const medianIndex = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
      ? (sortedArray[medianIndex - 1] + sortedArray[medianIndex]) / 2
      : sortedArray[medianIndex];
  }
  
  /**
   * Reinicia el procesador de presión arterial
   */
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.lastSystolic = 0;
    this.lastDiastolic = 0;
    this.lastCalculationTime = 0;
    console.log("BloodPressureProcessor: Reinicio completado");
  }
}
