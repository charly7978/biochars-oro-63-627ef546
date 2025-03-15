
/**
 * Implementación avanzada de un detector de picos para señales PPG
 * basado en derivadas de segundo orden y análisis morfológico.
 * 
 * NOTA IMPORTANTE: Este módulo implementa técnicas avanzadas manteniendo
 * compatibilidad con las interfaces principales en index.tsx y PPGSignalMeter.tsx.
 */

export class PeakDetector {
  // Parámetros de detección - recalibrados para reducir falsos positivos
  private readonly MIN_PEAK_DISTANCE_MS = 450; // Aumentado (antes: 400) para reducir falsos positivos
  private readonly MAX_PEAK_DISTANCE_MS = 1500; // Aumentado para cubrir ritmos cardíacos más lentos
  private readonly SAMPLING_RATE = 30; // Muestras por segundo (aproximado)
  
  // Configuración del algoritmo - ajustado para mayor precisión
  private readonly SLOPE_SUM_WINDOW = 8; // Ventana para función suma de pendientes
  private readonly DERIVATIVE_WINDOW = 5; // Ventana para derivada
  private readonly VERIFICATION_WINDOW = 5; // Aumentado (antes: 3) para mejor verificación
  
  // Estado interno
  private lastPeakIndex: number = -1;
  private lastPeakTime: number = 0;
  private peakThreshold: number = 0.35; // Aumentado (antes: 0.3) para reducir falsos positivos
  private adaptiveThreshold: number = 0.35; // Aumentado (antes: 0.3)
  private rrIntervals: number[] = [];
  private consecutiveGoodIntervals: number = 0;
  private readonly MIN_GOOD_INTERVALS = 3; // Nuevo: mínimo de intervalos válidos consecutivos
  
  constructor() {
    console.log('Detector avanzado de picos inicializado con umbral mejorado');
  }
  
  /**
   * Detecta picos en la señal PPG utilizando un algoritmo avanzado
   * basado en derivadas de segundo orden y suma de pendientes
   * con mejoras para reducción de falsos positivos
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
    
    // Calcular primera derivada
    const firstDerivative = this.calculateFirstDerivative(values);
    
    // Calcular segunda derivada
    const secondDerivative = this.calculateFirstDerivative(firstDerivative);
    
    // Función suma de pendientes para realzar picos
    const slopeSum = this.calculateSlopeSum(firstDerivative);
    
    // Combinar información para detección robusta
    const peakIndices: number[] = [];
    const valleyIndices: number[] = [];
    
    // Ajustar threshold basado en amplitud de señal
    this.updateAdaptiveThreshold(slopeSum);
    
    // Detección de picos usando múltiples criterios
    for (let i = 4; i < values.length - 4; i++) {
      // Criterio 1: Pico local en señal original (ventana ampliada)
      const isPeak = values[i] > values[i-1] && 
                     values[i] > values[i-2] && 
                     values[i] > values[i-3] && 
                     values[i] > values[i+1] && 
                     values[i] > values[i+2] &&
                     values[i] > values[i+3];
      
      // Criterio 2: Segunda derivada negativa (característica de pico)
      const isInflection = secondDerivative[i-4] < -this.adaptiveThreshold * 0.3; // Más exigente
      
      // Criterio 3: Función suma de pendientes positiva
      const hasPositiveSlope = slopeSum[i-4] > this.adaptiveThreshold * 1.2; // Más exigente
      
      // Criterio adicional: Amplitud mínima del pico relativa al valor promedio
      const localAvg = this.calculateLocalAverage(values, i, 10);
      const peakProminence = values[i] - localAvg;
      const hasMinProminence = peakProminence > this.adaptiveThreshold * 2.5; // Criterio de prominencia
      
      // Combinar criterios - más restrictivo para reducir falsos positivos
      if (isPeak && isInflection && hasPositiveSlope && hasMinProminence) {
        // Verificar distancia mínima desde último pico
        const minSampleDistance = this.MIN_PEAK_DISTANCE_MS / (1000 / this.SAMPLING_RATE);
        
        if (i - this.lastPeakIndex > minSampleDistance) {
          peakIndices.push(i);
          
          // Calcular intervalo RR en milisegundos
          if (this.lastPeakIndex >= 0) {
            const rrInterval = (i - this.lastPeakIndex) * (1000 / this.SAMPLING_RATE);
            
            // Verificar si el intervalo es fisiológicamente válido con criterios más estrictos
            const isValidInterval = rrInterval >= this.MIN_PEAK_DISTANCE_MS && 
                                  rrInterval <= this.MAX_PEAK_DISTANCE_MS;
            
            if (isValidInterval) {
              this.rrIntervals.push(rrInterval);
              this.consecutiveGoodIntervals++;
              
              // Mantener un buffer limitado de intervalos
              if (this.rrIntervals.length > 20) {
                this.rrIntervals.shift();
              }
            } else {
              // Reiniciar contador de intervalos consecutivos buenos
              this.consecutiveGoodIntervals = 0;
            }
          }
          
          this.lastPeakIndex = i;
          this.lastPeakTime = Date.now();
        }
      }
      
      // Detección de valles (mínimos locales) - criterios más estrictos
      const isValley = values[i] < values[i-1] && 
                       values[i] < values[i-2] && 
                       values[i] < values[i+1] && 
                       values[i] < values[i+2];
                       
      const valleyProminence = localAvg - values[i];
      const hasMinValleyProminence = valleyProminence > this.adaptiveThreshold;
      
      if (isValley && hasMinValleyProminence) {
        valleyIndices.push(i);
      }
    }
    
    return {
      peakIndices,
      valleyIndices,
      intervals: this.getValidIntervals(),
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
    this.peakThreshold = 0.35;
    this.adaptiveThreshold = 0.35;
    this.rrIntervals = [];
    this.consecutiveGoodIntervals = 0;
  }
}
