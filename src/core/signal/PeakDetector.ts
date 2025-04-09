
export interface RRData {
  intervals: number[];
  lastPeakTime: number | null;
}

export class PeakDetector {
  // Parámetros optimizados basados en investigación clínica
  private readonly MIN_PEAK_DISTANCE_MS = 450;
  private readonly MAX_PEAK_DISTANCE_MS = 1500;
  private readonly SAMPLING_RATE = 30;
  private readonly SLOPE_SUM_WINDOW = 8;
  private readonly DERIVATIVE_WINDOW = 5;
  private readonly VERIFICATION_WINDOW = 5;
  
  private lastPeakIndex: number = -1;
  private lastPeakTime: number = 0;
  private peakThreshold: number = 0.35;
  private adaptiveThreshold: number = 0.35;
  private rrIntervals: number[] = [];
  private consecutiveGoodIntervals: number = 0;
  private readonly MIN_GOOD_INTERVALS = 3;
  
  constructor() {
    this.reset();
  }
  
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
    
    // Calcular suma de pendientes para realzar picos
    const slopeSum = this.calculateSlopeSum(firstDerivative);
    
    // Actualizar umbral adaptativo
    this.updateAdaptiveThreshold(slopeSum);
    
    // Detectar picos utilizando suma de pendientes y umbral adaptativo
    const peakIndices: number[] = [];
    const valleyIndices: number[] = [];
    
    for (let i = this.VERIFICATION_WINDOW; i < slopeSum.length - this.VERIFICATION_WINDOW; i++) {
      // Verificar si es un pico potencial
      if (slopeSum[i] > this.adaptiveThreshold) {
        // Verificar si es un máximo local
        let isPeak = true;
        for (let j = 1; j <= this.VERIFICATION_WINDOW; j++) {
          if (slopeSum[i] < slopeSum[i - j] || slopeSum[i] < slopeSum[i + j]) {
            isPeak = false;
            break;
          }
        }
        
        if (isPeak) {
          // Verificar distancia temporal desde el último pico
          const timeSinceLastPeak = (i - this.lastPeakIndex) * (1000 / this.SAMPLING_RATE);
          
          if (this.lastPeakIndex === -1 || 
              (timeSinceLastPeak >= this.MIN_PEAK_DISTANCE_MS && 
               timeSinceLastPeak <= this.MAX_PEAK_DISTANCE_MS)) {
            
            // Encontrar el pico real en la señal original
            const peakIndex = this.findPrecisePeakIndex(values, i, 5);
            peakIndices.push(peakIndex);
            
            // Calcular intervalo RR
            if (this.lastPeakIndex !== -1) {
              const interval = timeSinceLastPeak;
              
              // Validar intervalo
              if (interval >= this.MIN_PEAK_DISTANCE_MS && interval <= this.MAX_PEAK_DISTANCE_MS) {
                this.rrIntervals.push(interval);
                
                // Mantener tamaño máximo de historia de intervalos
                if (this.rrIntervals.length > 10) {
                  this.rrIntervals.shift();
                }
              }
            }
            
            this.lastPeakIndex = i;
            this.lastPeakTime = Date.now();
          }
        }
      }
      
      // Detectar valles (puede ser útil para otras métricas)
      if (slopeSum[i] < -this.adaptiveThreshold * 0.5) {
        let isValley = true;
        for (let j = 1; j <= this.VERIFICATION_WINDOW; j++) {
          if (slopeSum[i] > slopeSum[i - j] || slopeSum[i] > slopeSum[i + j]) {
            isValley = false;
            break;
          }
        }
        
        if (isValley) {
          const valleyIndex = this.findPreciseValleyIndex(values, i, 5);
          valleyIndices.push(valleyIndex);
        }
      }
    }
    
    return {
      peakIndices,
      valleyIndices,
      intervals: this.getValidIntervals(),
      lastPeakTime: this.lastPeakTime
    };
  }
  
  private getValidIntervals(): number[] {
    if (this.rrIntervals.length < 3) return [];
    
    // Calcular percentiles para filtrar valores atípicos
    const sortedIntervals = [...this.rrIntervals].sort((a, b) => a - b);
    const lowerIdx = Math.floor(sortedIntervals.length * 0.25);
    const upperIdx = Math.floor(sortedIntervals.length * 0.75);
    const lowerBound = sortedIntervals[lowerIdx] * 0.7;
    const upperBound = sortedIntervals[upperIdx] * 1.3;
    
    // Filtrar intervalos válidos
    return this.rrIntervals.filter(interval => 
      interval >= lowerBound && interval <= upperBound);
  }
  
  private findPrecisePeakIndex(values: number[], approxIndex: number, window: number): number {
    let maxVal = values[approxIndex];
    let maxIdx = approxIndex;
    
    const start = Math.max(0, approxIndex - window);
    const end = Math.min(values.length - 1, approxIndex + window);
    
    for (let i = start; i <= end; i++) {
      if (values[i] > maxVal) {
        maxVal = values[i];
        maxIdx = i;
      }
    }
    
    return maxIdx;
  }
  
  private findPreciseValleyIndex(values: number[], approxIndex: number, window: number): number {
    let minVal = values[approxIndex];
    let minIdx = approxIndex;
    
    const start = Math.max(0, approxIndex - window);
    const end = Math.min(values.length - 1, approxIndex + window);
    
    for (let i = start; i <= end; i++) {
      if (values[i] < minVal) {
        minVal = values[i];
        minIdx = i;
      }
    }
    
    return minIdx;
  }
  
  private calculateFirstDerivative(values: number[]): number[] {
    const derivative: number[] = [];
    
    for (let i = this.DERIVATIVE_WINDOW; i < values.length; i++) {
      let sum = 0;
      for (let j = 1; j <= this.DERIVATIVE_WINDOW; j++) {
        sum += values[i] - values[i - j];
      }
      derivative.push(sum / this.DERIVATIVE_WINDOW);
    }
    
    return derivative;
  }
  
  private calculateSlopeSum(derivative: number[]): number[] {
    const slopeSum: number[] = [];
    
    for (let i = 0; i < derivative.length - this.SLOPE_SUM_WINDOW; i++) {
      let sum = 0;
      for (let j = 0; j < this.SLOPE_SUM_WINDOW; j++) {
        sum += Math.max(0, derivative[i + j]);
      }
      slopeSum.push(sum);
    }
    
    return slopeSum;
  }
  
  private updateAdaptiveThreshold(slopeSum: number[]): void {
    if (slopeSum.length === 0) return;
    
    // Calcular valores estadísticos
    const max = Math.max(...slopeSum);
    const mean = slopeSum.reduce((sum, val) => sum + val, 0) / slopeSum.length;
    
    // Actualizar umbral adaptativo
    const newThreshold = mean + (max - mean) * 0.3;
    this.adaptiveThreshold = this.adaptiveThreshold * 0.7 + newThreshold * 0.3;
    
    // Limitar a un rango razonable
    this.adaptiveThreshold = Math.max(0.2, Math.min(0.6, this.adaptiveThreshold));
  }
  
  public reset(): void {
    this.lastPeakIndex = -1;
    this.lastPeakTime = 0;
    this.peakThreshold = 0.35;
    this.adaptiveThreshold = 0.35;
    this.rrIntervals = [];
    this.consecutiveGoodIntervals = 0;
  }
}
