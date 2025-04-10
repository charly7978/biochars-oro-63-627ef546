
/**
 * Filtros para Procesamiento de Señal
 * Implementaciones de filtros usados en el procesamiento de señales
 */

/**
 * Filtro de Kalman para suavizado de señal
 */
export class KalmanFilter {
  private P: number = 1; // Covarianza de error de estimación
  private X: number = 0; // Valor estimado
  private K: number = 0; // Ganancia de Kalman
  
  /**
   * Constructor
   * @param R Ruido de medición (menor = confía más en las mediciones)
   * @param Q Ruido de proceso (menor = más suavizado)
   */
  constructor(
    private R: number = 0.01,
    private Q: number = 0.1
  ) {}
  
  /**
   * Aplicar filtro de Kalman a una medición
   */
  filter(measurement: number): number {
    // Paso de predicción
    this.P = this.P + this.Q;
    
    // Paso de actualización
    this.K = this.P / (this.P + this.R);
    this.X = this.X + this.K * (measurement - this.X);
    this.P = (1 - this.K) * this.P;
    
    return this.X;
  }
  
  /**
   * Reiniciar filtro
   */
  reset(): void {
    this.X = 0;
    this.P = 1;
  }
  
  /**
   * Actualizar parámetros del filtro
   */
  updateParameters(params: { R?: number; Q?: number }): void {
    if (params.R !== undefined) this.R = params.R;
    if (params.Q !== undefined) this.Q = params.Q;
  }
}

/**
 * Filtro de Media Móvil Simple (SMA)
 */
export function applySMAFilter(
  value: number,
  buffer: number[],
  windowSize: number = 5
): { filteredValue: number; updatedBuffer: number[] } {
  const updatedBuffer = [...buffer, value];
  
  // Mantener buffer en tamaño de ventana
  if (updatedBuffer.length > windowSize) {
    updatedBuffer.shift();
  }
  
  // Calcular promedio
  const filteredValue = updatedBuffer.reduce((a, b) => a + b, 0) / updatedBuffer.length;
  
  return { filteredValue, updatedBuffer };
}

/**
 * Filtro de Media Móvil Exponencial (EMA)
 */
export function applyEMAFilter(
  value: number,
  previousEMA: number | null,
  alpha: number = 0.3
): number {
  if (previousEMA === null) return value;
  return alpha * value + (1 - alpha) * previousEMA;
}

/**
 * Filtro de Mediana
 */
export function applyMedianFilter(
  value: number,
  buffer: number[],
  windowSize: number = 5
): { filteredValue: number; updatedBuffer: number[] } {
  const updatedBuffer = [...buffer, value];
  
  // Mantener buffer en tamaño de ventana
  if (updatedBuffer.length > windowSize) {
    updatedBuffer.shift();
  }
  
  // Calcular mediana
  const sortedValues = [...updatedBuffer].sort((a, b) => a - b);
  const filteredValue = sortedValues[Math.floor(sortedValues.length / 2)];
  
  return { filteredValue, updatedBuffer };
}

/**
 * Filtro Pasa Banda Digital Simple
 */
export function applyBandpassFilter(
  value: number,
  buffer: { input: number[]; output: number[] },
  lowCutoff: number = 0.5,
  highCutoff: number = 4.0,
  sampleRate: number = 30
): { filteredValue: number; updatedBuffer: { input: number[]; output: number[] } } {
  // Coeficientes del filtro (simplificados)
  const dt = 1 / sampleRate;
  const RC_low = 1 / (2 * Math.PI * lowCutoff);
  const RC_high = 1 / (2 * Math.PI * highCutoff);
  const alpha_low = dt / (RC_low + dt);
  const alpha_high = RC_high / (RC_high + dt);
  
  // Copiar buffer
  const newBuffer = {
    input: [...buffer.input, value],
    output: [...buffer.output]
  };
  
  // Mantener tamaño
  if (newBuffer.input.length > 3) newBuffer.input.shift();
  if (newBuffer.output.length > 3) newBuffer.output.shift();
  
  // Aplicar filtro
  let filteredValue = value;
  
  // Paso alto (elimina componentes de baja frecuencia)
  if (newBuffer.input.length > 1) {
    filteredValue = alpha_high * (filteredValue - newBuffer.input[newBuffer.input.length - 2] + newBuffer.output[0]);
  }
  
  // Paso bajo (suaviza la señal)
  if (newBuffer.output.length > 0) {
    filteredValue = newBuffer.output[0] + alpha_low * (filteredValue - newBuffer.output[0]);
  }
  
  // Actualizar buffer de salida
  newBuffer.output.push(filteredValue);
  if (newBuffer.output.length > 3) newBuffer.output.shift();
  
  return { filteredValue, updatedBuffer: newBuffer };
}

/**
 * Detección de picos en una señal
 */
export function findPeaks(values: number[], minHeight: number = 0.1): number[] {
  const peakIndices: number[] = [];
  
  // Necesitamos al menos 3 puntos para detectar un pico
  if (values.length < 3) return peakIndices;
  
  // Buscar picos (punto más alto en una ventana de 3 puntos)
  for (let i = 1; i < values.length - 1; i++) {
    const v = values[i];
    if (v > values[i - 1] && v > values[i + 1] && v > minHeight) {
      peakIndices.push(i);
    }
  }
  
  return peakIndices;
}

/**
 * Detección de valles en una señal
 */
export function findValleys(values: number[], maxHeight: number = 0.9): number[] {
  const valleyIndices: number[] = [];
  
  // Necesitamos al menos 3 puntos para detectar un valle
  if (values.length < 3) return valleyIndices;
  
  // Buscar valles (punto más bajo en una ventana de 3 puntos)
  for (let i = 1; i < values.length - 1; i++) {
    const v = values[i];
    if (v < values[i - 1] && v < values[i + 1] && v < maxHeight) {
      valleyIndices.push(i);
    }
  }
  
  return valleyIndices;
}
