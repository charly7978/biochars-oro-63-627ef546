
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Implementación real de filtro de media móvil simple
 * Solo usa datos reales
 */
export function applySMAFilter(data: number[], windowSize: number): number[] {
  if (windowSize < 1 || data.length < windowSize) {
    return [...data];
  }
  
  const result: number[] = [];
  
  // Inicializar con los primeros valores sin filtrado
  for (let i = 0; i < windowSize - 1; i++) {
    result.push(data[i]);
  }
  
  // Aplicar ventana deslizante para el resto
  for (let i = windowSize - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += data[i - j];
    }
    result.push(sum / windowSize);
  }
  
  return result;
}

/**
 * Calcular amplitud de señal basada en valores reales
 */
export function calculateAmplitude(data: number[]): number {
  if (data.length === 0) return 0;
  
  let min = data[0];
  let max = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }
  
  return max - min;
}

/**
 * Encuentra picos y valles en una señal real
 */
export function findPeaksAndValleys(data: number[], minPeakDistance: number = 5): {
  peaks: number[];
  valleys: number[];
} {
  const peaks: number[] = [];
  const valleys: number[] = [];
  
  if (data.length < 3) return { peaks, valleys };
  
  // Detectar picos y valles
  for (let i = 1; i < data.length - 1; i++) {
    // Pico: mayor que vecinos
    if (data[i] > data[i-1] && data[i] > data[i+1]) {
      // Verificar distancia mínima con el último pico
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minPeakDistance) {
        peaks.push(i);
      } else if (data[i] > data[peaks[peaks.length - 1]]) {
        // Reemplazar el pico anterior si este es mayor
        peaks[peaks.length - 1] = i;
      }
    }
    
    // Valle: menor que vecinos
    if (data[i] < data[i-1] && data[i] < data[i+1]) {
      // Verificar distancia mínima con el último valle
      if (valleys.length === 0 || i - valleys[valleys.length - 1] >= minPeakDistance) {
        valleys.push(i);
      } else if (data[i] < data[valleys[valleys.length - 1]]) {
        // Reemplazar el valle anterior si este es menor
        valleys[valleys.length - 1] = i;
      }
    }
  }
  
  return { peaks, valleys };
}

/**
 * Implementación de filtro Kalman para procesamiento de señales
 * Esta implementación NO usa simulaciones, solo procesa datos reales
 */
export class KalmanFilter {
  private x: number; // Estado estimado
  private p: number; // Estimación de la covarianza del error
  private q: number; // Ruido del proceso
  private r: number; // Ruido de medición
  
  constructor(q: number = 0.001, r: number = 0.1) {
    this.x = 0;
    this.p = 1;
    this.q = q;
    this.r = r;
  }
  
  /**
   * Actualiza el estado con una nueva medición
   * Solo procesa datos reales
   */
  public update(measurement: number): number {
    // Predicción
    this.p = this.p + this.q;
    
    // Ganancia de Kalman
    const k = this.p / (this.p + this.r);
    
    // Corrección
    this.x = this.x + k * (measurement - this.x);
    this.p = (1 - k) * this.p;
    
    // Devolver estimación actualizada
    return this.x;
  }
  
  /**
   * Reinicia el filtro
   */
  public reset(): void {
    this.x = 0;
    this.p = 1;
  }
}
