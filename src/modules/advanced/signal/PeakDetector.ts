/**
 * Detector de picos simplificado con máxima sensibilidad
 */

export class PeakDetector {
  // Parámetros de detección poco restrictivos
  private readonly MIN_PEAK_DISTANCE_MS = 300; // Muy reducido
  private readonly MAX_PEAK_DISTANCE_MS = 2000; // Muy ampliado
  private readonly SAMPLING_RATE = 30; // Muestras por segundo (aproximado)
  
  // Configuración del algoritmo - sensibilidad máxima
  private readonly SLOPE_SUM_WINDOW = 5; // Ventana reducida
  private readonly DERIVATIVE_WINDOW = 3; // Ventana reducida
  private readonly VERIFICATION_WINDOW = 3; // Ventana reducida
  
  // Estado interno
  private lastPeakIndex: number = -1;
  private lastPeakTime: number = 0;
  private peakThreshold: number = 0.15; // Reducido al mínimo
  private adaptiveThreshold: number = 0.15; // Reducido al mínimo
  private rrIntervals: number[] = [];
  private consecutiveGoodIntervals: number = 3; // Siempre suficientes
  private readonly MIN_GOOD_INTERVALS = 1; // Sólo requiere 1 intervalo
  
  constructor() {
    console.log('Detector de picos inicializado con sensibilidad máxima');
  }
  
  /**
   * Detecta picos con criterios mínimos
   */
  public detectPeaks(values: number[]): {
    peakIndices: number[];
    valleyIndices: number[];
    intervals: number[];
    lastPeakTime: number;
  } {
    if (values.length < this.DERIVATIVE_WINDOW * 2) {
      return {
        peakIndices: [],
        valleyIndices: [],
        intervals: this.rrIntervals,
        lastPeakTime: this.lastPeakTime
      };
    }
    
    // Cálculos simplificados
    const firstDerivative = this.calculateFirstDerivative(values);
    const slopeSum = this.calculateSlopeSum(firstDerivative);
    
    // Detectar picos con criterios mínimos
    const peakIndices: number[] = [];
    const valleyIndices: number[] = [];
    
    // Umbral adaptativo mínimo
    this.adaptiveThreshold = 0.15;
    
    // Detección con criterios mínimos
    for (let i = 3; i < values.length - 3; i++) {
      // Criterio simplificado: solo busca máximo local
      const isPeak = values[i] > values[i-1] && values[i] > values[i+1];
      
      if (isPeak) {
        // Verificar distancia mínima muy permisiva
        const minSampleDistance = this.MIN_PEAK_DISTANCE_MS / (1000 / this.SAMPLING_RATE);
        
        if (i - this.lastPeakIndex > minSampleDistance / 2) { // Distancia reducida a la mitad
          peakIndices.push(i);
          
          // Calcular intervalo RR en milisegundos
          if (this.lastPeakIndex >= 0) {
            const rrInterval = (i - this.lastPeakIndex) * (1000 / this.SAMPLING_RATE);
            
            // Criterio muy permisivo
            const isValidInterval = rrInterval >= this.MIN_PEAK_DISTANCE_MS / 2 && 
                                  rrInterval <= this.MAX_PEAK_DISTANCE_MS * 1.5;
            
            if (isValidInterval) {
              this.rrIntervals.push(rrInterval);
              this.consecutiveGoodIntervals = 3; // Siempre suficientes
              
              // Mantener buffer limitado
              if (this.rrIntervals.length > 20) {
                this.rrIntervals.shift();
              }
            }
          }
          
          this.lastPeakIndex = i;
          this.lastPeakTime = Date.now();
        }
      }
      
      // Detección simple de valles
      const isValley = values[i] < values[i-1] && values[i] < values[i+1];
      
      if (isValley) {
        valleyIndices.push(i);
      }
    }
    
    return {
      peakIndices,
      valleyIndices,
      intervals: this.rrIntervals, // Retornar todos sin filtrar
      lastPeakTime: this.lastPeakTime
    };
  }
  
  /**
   * Filtra y retorna solo intervalos RR válidos
   * Nuevo método para mejorar la calidad de los intervalos
   */
  private getValidIntervals(): number[] {
    // Si no hay suficientes intervalos consecutivos buenos, retorna array vacío
    if (this.consecutiveGoodIntervals < this.MIN_GOOD_INTERVALS) {
      return [];
    }
    
    // Si hay suficientes intervalos, los filtra para eliminar valores atípicos
    if (this.rrIntervals.length > 3) {
      // Calcular media y desviación estándar
      const sum = this.rrIntervals.reduce((a, b) => a + b, 0);
      const mean = sum / this.rrIntervals.length;
      
      const squaredDiffs = this.rrIntervals.map(val => Math.pow(val - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / this.rrIntervals.length;
      const stdDev = Math.sqrt(variance);
      
      // Filtrar intervalos dentro de 2 desviaciones estándar
      return this.rrIntervals.filter(interval => 
        Math.abs(interval - mean) <= 2 * stdDev
      );
    }
    
    return this.rrIntervals;
  }
  
  /**
   * Calcula el promedio local alrededor de un punto
   * Nuevo método para mejor estimación de línea base
   */
  private calculateLocalAverage(values: number[], index: number, windowSize: number): number {
    const halfWindow = Math.floor(windowSize / 2);
    let sum = 0;
    let count = 0;
    
    const start = Math.max(0, index - halfWindow);
    const end = Math.min(values.length - 1, index + halfWindow);
    
    for (let i = start; i <= end; i++) {
      // Excluir el punto central y puntos adyacentes para mejor estimación de línea base
      if (Math.abs(i - index) > 2) {
        sum += values[i];
        count++;
      }
    }
    
    return count > 0 ? sum / count : values[index];
  }
  
  /**
   * Calcula la primera derivada de la señal
   */
  private calculateFirstDerivative(values: number[]): number[] {
    const derivative: number[] = [];
    
    for (let i = this.DERIVATIVE_WINDOW; i < values.length; i++) {
      let sum = 0;
      for (let j = 1; j <= this.DERIVATIVE_WINDOW; j++) {
        sum += (values[i] - values[i-j]) / j;
      }
      derivative.push(sum / this.DERIVATIVE_WINDOW);
    }
    
    return derivative;
  }
  
  /**
   * Calcula la función suma de pendientes para realzar características de pico
   */
  private calculateSlopeSum(derivative: number[]): number[] {
    const slopeSum: number[] = [];
    
    for (let i = this.SLOPE_SUM_WINDOW; i < derivative.length; i++) {
      let sum = 0;
      for (let j = 0; j < this.SLOPE_SUM_WINDOW; j++) {
        // Solo sumar pendientes positivas
        sum += Math.max(0, derivative[i-j]);
      }
      slopeSum.push(sum);
    }
    
    return slopeSum;
  }
  
  /**
   * Actualiza el umbral adaptativo basado en la amplitud de la señal
   * Mejorado para adaptarse mejor a diferentes calidades de señal
   */
  private updateAdaptiveThreshold(slopeSum: number[]): void {
    if (slopeSum.length < 10) return;
    
    // Calcular estadísticas de la señal
    const values = slopeSum.slice(-30);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    
    // Calcular threshold adaptativo con factor más restrictivo
    const range = max - min;
    this.adaptiveThreshold = mean + 0.35 * range; // Aumentado de 0.3 a 0.35
    
    // Limitar a valores razonables más restrictivos
    this.adaptiveThreshold = Math.max(0.15, Math.min(0.7, this.adaptiveThreshold));
  }
  
  /**
   * Reinicia el detector de picos
   */
  public reset(): void {
    this.lastPeakIndex = -1;
    this.lastPeakTime = 0;
    this.peakThreshold = 0.15;
    this.adaptiveThreshold = 0.15;
    this.rrIntervals = [];
    this.consecutiveGoodIntervals = 3;
  }
}
