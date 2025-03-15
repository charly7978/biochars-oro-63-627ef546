
/**
 * Implementación avanzada de un detector de picos para señales PPG
 * basado en derivadas de segundo orden y análisis morfológico.
 * 
 * NOTA IMPORTANTE: Este módulo implementa técnicas avanzadas manteniendo
 * compatibilidad con las interfaces principales en index.tsx y PPGSignalMeter.tsx.
 */

export class PeakDetector {
  // Parámetros de detección
  private readonly MIN_PEAK_DISTANCE_MS = 400; // Distancia mínima entre picos
  private readonly MAX_PEAK_DISTANCE_MS = 1200; // Distancia máxima para considerar picos válidos
  private readonly SAMPLING_RATE = 30; // Muestras por segundo (aproximado)
  
  // Configuración del algoritmo
  private readonly SLOPE_SUM_WINDOW = 8; // Ventana para función suma de pendientes
  private readonly DERIVATIVE_WINDOW = 5; // Ventana para derivada
  private readonly VERIFICATION_WINDOW = 3; // Ventana para verificación de picos
  
  // Estado interno
  private lastPeakIndex: number = -1;
  private lastPeakTime: number = 0;
  private peakThreshold: number = 0.3;
  private adaptiveThreshold: number = 0.3;
  private rrIntervals: number[] = [];
  
  constructor() {
    console.log('Detector avanzado de picos inicializado');
  }
  
  /**
   * Detecta picos en la señal PPG utilizando un algoritmo avanzado
   * basado en derivadas de segundo orden y suma de pendientes
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
    for (let i = 2; i < values.length - 2; i++) {
      // Criterio 1: Pico local en señal original
      const isPeak = values[i] > values[i-1] && 
                     values[i] > values[i-2] && 
                     values[i] > values[i+1] && 
                     values[i] > values[i+2];
      
      // Criterio 2: Segunda derivada negativa (característica de pico)
      const isInflection = secondDerivative[i-2] < -this.adaptiveThreshold * 0.2;
      
      // Criterio 3: Función suma de pendientes positiva
      const hasPositiveSlope = slopeSum[i-2] > this.adaptiveThreshold;
      
      // Combinar criterios
      if (isPeak && (isInflection || hasPositiveSlope)) {
        // Verificar distancia mínima desde último pico
        const minSampleDistance = this.MIN_PEAK_DISTANCE_MS / (1000 / this.SAMPLING_RATE);
        
        if (i - this.lastPeakIndex > minSampleDistance) {
          peakIndices.push(i);
          
          // Calcular intervalo RR en milisegundos
          if (this.lastPeakIndex >= 0) {
            const rrInterval = (i - this.lastPeakIndex) * (1000 / this.SAMPLING_RATE);
            
            // Verificar si el intervalo es fisiológicamente válido
            if (rrInterval >= this.MIN_PEAK_DISTANCE_MS && rrInterval <= this.MAX_PEAK_DISTANCE_MS) {
              this.rrIntervals.push(rrInterval);
              
              // Mantener un buffer limitado de intervalos
              if (this.rrIntervals.length > 20) {
                this.rrIntervals.shift();
              }
            }
          }
          
          this.lastPeakIndex = i;
          this.lastPeakTime = Date.now();
        }
      }
      
      // Detección de valles (mínimos locales)
      const isValley = values[i] < values[i-1] && 
                       values[i] < values[i-2] && 
                       values[i] < values[i+1] && 
                       values[i] < values[i+2];
                       
      if (isValley) {
        valleyIndices.push(i);
      }
    }
    
    return {
      peakIndices,
      valleyIndices,
      intervals: this.rrIntervals,
      lastPeakTime: this.lastPeakTime
    };
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
   */
  private updateAdaptiveThreshold(slopeSum: number[]): void {
    if (slopeSum.length < 10) return;
    
    // Calcular estadísticas de la señal
    const values = slopeSum.slice(-30);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    
    // Calcular threshold adaptativo
    const range = max - min;
    this.adaptiveThreshold = mean + 0.3 * range;
    
    // Limitar a valores razonables
    this.adaptiveThreshold = Math.max(0.1, Math.min(0.6, this.adaptiveThreshold));
  }
  
  /**
   * Reinicia el detector de picos
   */
  public reset(): void {
    this.lastPeakIndex = -1;
    this.lastPeakTime = 0;
    this.peakThreshold = 0.3;
    this.adaptiveThreshold = 0.3;
    this.rrIntervals = [];
  }
}
