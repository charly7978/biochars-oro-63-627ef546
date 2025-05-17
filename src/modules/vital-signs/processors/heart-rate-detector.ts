
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Detector mejorado de frecuencia cardíaca con mayor robustez y precisión
 * Implementa algoritmos avanzados para filtrado y detección de ritmo cardiaco real
 */
export class HeartRateDetector {
  private ppgBuffer: number[] = [];
  private filteredBuffer: number[] = [];
  private peakTimes: number[] = [];
  private lastPeakTime: number | null = null;
  private consecutiveValidBeats: number = 0;
  private lastBpm: number = 0;
  
  // Parámetros optimizados para detección robusta
  private readonly MIN_PEAK_DISTANCE_MS = 300; // Mínimo 30 BPM
  private readonly MAX_PEAK_DISTANCE_MS = 1500; // Máximo 200 BPM
  private readonly MIN_PEAK_HEIGHT = 0.010; // Umbral adaptativo para detección (reducido)
  private readonly MAX_BPM_CHANGE = 18; // Máximo cambio permitido entre mediciones (aumentado)
  
  // Nuevos parámetros para mejorar estabilidad
  private readonly MIN_SAMPLES_FOR_VALID_MEASUREMENT = 25; // Reducido para respuesta más rápida
  private readonly MIN_PEAKS_FOR_STABLE_BPM = 3;  // Mínimo de picos para calcular BPM estable (reducido)
  private readonly PEAK_PROMINENCE_FACTOR = 0.30; // Factor para determinar prominencia de picos (reducido)
  private readonly SMOOTHING_FACTOR = 0.35;       // Factor de suavizado para BPM (aumentado)
  
  constructor() {
    this.reset();
    console.log("HeartRateDetector: Inicializado con parámetros mejorados");
  }
  
  /**
   * Calcula la frecuencia cardíaca a partir de señales PPG reales
   * Implementa filtrado robusto y detección resistente a artefactos
   */
  public calculateHeartRate(ppgValues: number[], sampleRate: number = 30): number {
    if (ppgValues.length < this.MIN_SAMPLES_FOR_VALID_MEASUREMENT) {
      console.log("HeartRateDetector: Buffer insuficiente para análisis", {
        valuesLength: ppgValues.length,
        required: this.MIN_SAMPLES_FOR_VALID_MEASUREMENT
      });
      return this.lastBpm > 0 ? this.lastBpm : 0;
    }
    
    // Almacenar valores y aplicar filtro adicional para mejorar robustez
    this.ppgBuffer = [...ppgValues];
    this.filteredBuffer = this.applyAdditionalFiltering(ppgValues);
    
    // Detectar picos con algoritmo mejorado
    const peakIndices = this.detectPeaksRobust(this.filteredBuffer);
    
    console.log("HeartRateDetector: Picos detectados", {
      peakCount: peakIndices.length,
      minNeeded: this.MIN_PEAKS_FOR_STABLE_BPM
    });
    
    if (peakIndices.length < this.MIN_PEAKS_FOR_STABLE_BPM) {
      return this.lastBpm > 0 ? this.lastBpm : 0;
    }
    
    // Calcular intervalos entre picos
    const intervals: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const interval = (peakIndices[i] - peakIndices[i-1]) * (1000 / sampleRate);
      if (interval >= this.MIN_PEAK_DISTANCE_MS && interval <= this.MAX_PEAK_DISTANCE_MS) {
        intervals.push(interval);
      }
    }
    
    console.log("HeartRateDetector: Intervalos válidos", {
      validIntervals: intervals.length,
      requiredIntervals: this.MIN_PEAKS_FOR_STABLE_BPM - 1
    });
    
    if (intervals.length < this.MIN_PEAKS_FOR_STABLE_BPM - 1) {
      return this.lastBpm > 0 ? this.lastBpm : 0;
    }
    
    // Filtrar valores atípicos
    const filteredIntervals = this.removeOutliers(intervals);
    
    if (filteredIntervals.length < 2) {
      return this.lastBpm > 0 ? this.lastBpm : 0;
    }
    
    // Calcular BPM medio a partir de todos los intervalos válidos
    const avgInterval = filteredIntervals.reduce((sum, val) => sum + val, 0) / filteredIntervals.length;
    const currentBpm = Math.round(60000 / avgInterval);
    
    console.log("HeartRateDetector: BPM calculado", {
      avgInterval,
      currentBpm,
      lastBpm: this.lastBpm
    });
    
    // Actualizar BPM con suavizado para estabilidad
    let newBpm = currentBpm;
    if (this.lastBpm > 0) {
      // Si hay cambio extremo, verificar validez
      if (Math.abs(currentBpm - this.lastBpm) > this.MAX_BPM_CHANGE) {
        this.consecutiveValidBeats = 0;
        
        // Si el cambio es muy grande pero parece plausible, adaptar más lentamente
        if (currentBpm >= 40 && currentBpm <= 200) {
          // Adaptar en dirección al nuevo valor pero con más resistencia
          const direction = currentBpm > this.lastBpm ? 1 : -1;
          newBpm = this.lastBpm + (direction * this.MAX_BPM_CHANGE / 2);
          console.log("HeartRateDetector: Cambio grande pero plausible, adaptando gradualmente", {
            direction,
            adjustment: direction * this.MAX_BPM_CHANGE / 2
          });
        } else {
          // Si está fuera de rango fisiológico, mantener el último valor
          newBpm = this.lastBpm;
          console.log("HeartRateDetector: Cambio fuera de rango fisiológico, manteniendo último valor");
        }
      } else {
        // Cambio válido, aplicar suavizado
        this.consecutiveValidBeats++;
        // Usar suavizado exponencial con factor aumentado para respuesta más rápida
        newBpm = Math.round(this.lastBpm * (1 - this.SMOOTHING_FACTOR) + currentBpm * this.SMOOTHING_FACTOR);
        
        console.log("HeartRateDetector: Cambio válido con suavizado", {
          currentBpm,
          smoothedBpm: newBpm,
          consecutiveValidBeats: this.consecutiveValidBeats
        });
      }
    } else {
      // Primer valor válido
      console.log("HeartRateDetector: Primer valor válido de BPM", { newBpm: currentBpm });
    }
    
    // Limitar BPM a rango fisiológico
    newBpm = Math.max(40, Math.min(200, newBpm));
    
    // Actualizar último BPM
    this.lastBpm = newBpm;
    
    // Actualizar tiempos de picos para cálculo de RR
    this.updatePeakTimes(peakIndices, sampleRate);
    
    return newBpm;
  }
  
  /**
   * Método mejorado de detección de picos con mayor robustez
   * Implementa un algoritmo adaptativo con ventanas móviles
   */
  private detectPeaksRobust(values: number[]): number[] {
    if (values.length < 10) return [];
    
    const peakIndices: number[] = [];
    // Tamaño de ventana para detección adaptativa
    const windowSize = Math.min(30, Math.floor(values.length / 3));
    
    // Determinar umbral adaptativo basado en amplitud local
    for (let i = windowSize; i < values.length - windowSize; i++) {
      const localWindow = values.slice(i - windowSize, i + windowSize);
      const localMax = Math.max(...localWindow);
      const localMin = Math.min(...localWindow);
      const localRange = localMax - localMin;
      
      // Calcular umbral adaptativo basado en rango local
      const threshold = localMin + (localRange * this.PEAK_PROMINENCE_FACTOR);
      
      // Determinar si el punto actual es un máximo local
      if (values[i] > threshold && 
          values[i] > values[i-1] && 
          values[i] > values[i+1] &&
          values[i] > values[i-2] && 
          values[i] > values[i+2]) {
        
        // Verificar que no haya un pico mayor en la vecindad
        let isMaximal = true;
        for (let j = Math.max(0, i - 5); j < Math.min(values.length, i + 6); j++) {
          if (j !== i && values[j] > values[i]) {
            isMaximal = false;
            break;
          }
        }
        
        if (isMaximal) {
          // Verificar distancia desde el último pico
          if (peakIndices.length === 0 || (i - peakIndices[peakIndices.length - 1]) >= Math.floor(this.MIN_PEAK_DISTANCE_MS / (1000 / 30))) {
            peakIndices.push(i);
          }
        }
      }
    }
    
    return peakIndices;
  }
  
  /**
   * Aplica filtrado adicional para mejorar la detección de picos
   * Implementa filtros óptimos para señales PPG
   */
  private applyAdditionalFiltering(values: number[]): number[] {
    if (values.length < 5) return values;
    
    // Filtro mediana para eliminar valores atípicos
    const medianFiltered = this.applyMedianFilter(values, 5);
    
    // Filtro Savitzky-Golay simplificado para suavizar preservando picos
    return this.applySavitzkyGolayFilter(medianFiltered);
  }
  
  /**
   * Filtro mediana para eliminar ruido impulsivo
   */
  private applyMedianFilter(values: number[], windowSize: number): number[] {
    const result: number[] = [];
    const halfWindow = Math.floor(windowSize / 2);
    
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(values.length - 1, i + halfWindow);
      
      const window = values.slice(start, end + 1).sort((a, b) => a - b);
      result.push(window[Math.floor(window.length / 2)]);
    }
    
    return result;
  }
  
  /**
   * Implementación simplificada del filtro Savitzky-Golay
   * para suavizar la señal preservando las características de los picos
   */
  private applySavitzkyGolayFilter(values: number[]): number[] {
    // Coeficientes para ventana de 5 puntos (grado 2)
    const coefs = [-3, 12, 17, 12, -3];
    const norm = 35;
    
    const result: number[] = [];
    
    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      for (let j = -2; j <= 2; j++) {
        const idx = i + j;
        if (idx >= 0 && idx < values.length) {
          sum += values[idx] * coefs[j + 2];
        } else if (idx < 0) {
          sum += values[0] * coefs[j + 2];
        } else {
          sum += values[values.length - 1] * coefs[j + 2];
        }
      }
      result.push(sum / norm);
    }
    
    return result;
  }
  
  /**
   * Elimina valores atípicos de los intervalos RR
   */
  private removeOutliers(intervals: number[]): number[] {
    if (intervals.length <= 2) return intervals;
    
    // Calcular mediana
    const sorted = [...intervals].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // Calcular desviación absoluta mediana (MAD)
    const deviations = intervals.map(val => Math.abs(val - median));
    const mad = deviations.sort((a, b) => a - b)[Math.floor(deviations.length / 2)];
    
    // Filtrar intervalos utilizando criterio MAD (más robusto que desviación estándar)
    // Umbral aumentado para mayor sensibilidad
    const madThreshold = 3.0; // Umbral aumentado para mayor tolerancia a variaciones
    return intervals.filter(val => Math.abs(val - median) <= madThreshold * mad);
  }
  
  /**
   * Actualiza tiempos de picos para cálculo de intervalos RR
   */
  private updatePeakTimes(peakIndices: number[], sampleRate: number): void {
    const now = Date.now();
    const msPerSample = 1000 / sampleRate;
    
    // Convertir índices de muestras a tiempos absolutos
    this.peakTimes = peakIndices.map(idx => now - (peakIndices.length - 1 - idx) * msPerSample);
    
    if (this.peakTimes.length > 0) {
      this.lastPeakTime = this.peakTimes[this.peakTimes.length - 1];
    }
    
    console.log("HeartRateDetector: Peak times actualizados", {
      peakCount: this.peakTimes.length,
      lastPeakTime: this.lastPeakTime
    });
  }
  
  /**
   * Devuelve los tiempos de picos detectados
   */
  public getPeakTimes(): number[] {
    return this.peakTimes;
  }
  
  /**
   * Obtiene los intervalos RR para análisis
   */
  public getRRIntervals(): { intervals: number[], lastPeakTime: number | null } {
    if (this.peakTimes.length < 2) {
      return { intervals: [], lastPeakTime: this.lastPeakTime };
    }
    
    const intervals: number[] = [];
    for (let i = 1; i < this.peakTimes.length; i++) {
      const interval = this.peakTimes[i] - this.peakTimes[i-1];
      // Validación fisiológica menos estricta: 35-220 BPM
      if (interval >= 270 && interval <= 1700) {
        intervals.push(interval);
      }
    }
    
    console.log("HeartRateDetector: RR intervals generados", {
      intervalCount: intervals.length,
      lastPeakTime: this.lastPeakTime
    });
    
    return {
      intervals,
      lastPeakTime: this.lastPeakTime
    };
  }
  
  /**
   * Reinicia el detector
   */
  public reset(): void {
    this.ppgBuffer = [];
    this.filteredBuffer = [];
    this.peakTimes = [];
    this.lastPeakTime = null;
    this.consecutiveValidBeats = 0;
    this.lastBpm = 0;
    console.log("HeartRateDetector: Reset completo");
  }
}
