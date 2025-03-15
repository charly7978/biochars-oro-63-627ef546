
/**
 * Analizador morfológico de onda PPG
 * 
 * Este módulo implementa algoritmos para analizar la forma de la onda PPG
 * y extraer características morfológicas importantes para diagnóstico
 */

/**
 * Características morfológicas de la onda PPG
 */
export interface MorphologyFeatures {
  perfusion: number;         // Índice de perfusión (0-1)
  dicroticNotchTime: number; // Tiempo de la muesca dicrótica (ms)
  systolicPeakTime: number;  // Tiempo del pico sistólico (ms)
  diastolicTime: number;     // Tiempo diastólico (ms)
  risingSlope: number;       // Pendiente de subida
  fallingSlope: number;      // Pendiente de bajada
}

/**
 * Analizador de la morfología de la onda PPG
 */
export class PPGMorphologyAnalyzer {
  // Configuración del análisis
  private readonly WINDOW_SIZE = 50;
  private readonly SAMPLING_RATE = 30; // Hz
  
  /**
   * Analiza la forma de onda PPG y extrae características morfológicas
   */
  public analyzeWaveform(ppgValues: number[]): MorphologyFeatures {
    if (ppgValues.length < this.WINDOW_SIZE) {
      return this.getDefaultFeatures();
    }
    
    // Usar los últimos valores para el análisis
    const recentValues = ppgValues.slice(-this.WINDOW_SIZE);
    
    // Identificar picos y valles
    const { peaks, valleys } = this.findPeaksAndValleys(recentValues);
    
    // Si no hay suficientes picos o valles, retornar valores por defecto
    if (peaks.length < 1 || valleys.length < 1) {
      return this.getDefaultFeatures();
    }
    
    // Calcular características morfológicas
    
    // 1. Índice de perfusión
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const ac = max - min;
    const dc = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const perfusion = (ac / dc) * 0.5; // Normalizado a rango típico
    
    // 2. Tiempos de características clave (convertidos a ms)
    const msPerSample = 1000 / this.SAMPLING_RATE;
    
    // Obtener el último pico sistólico
    const lastPeakIndex = peaks[peaks.length - 1];
    
    // Buscar la muesca dicrótica (si existe)
    const dicroticNotchIndex = this.findDicroticNotch(recentValues, lastPeakIndex);
    
    // Calcular tiempo de la muesca dicrótica
    const dicroticNotchTime = dicroticNotchIndex > 0 ? 
      (dicroticNotchIndex - lastPeakIndex) * msPerSample : 
      250; // Valor típico si no se encuentra
    
    // 3. Pendientes
    const risingSlope = this.calculateRisingSlope(recentValues, lastPeakIndex);
    const fallingSlope = this.calculateFallingSlope(recentValues, lastPeakIndex);
    
    // 4. Tiempo diastólico - desde el último pico al siguiente valle
    let diastolicIndex = 0;
    for (const valley of valleys) {
      if (valley > lastPeakIndex) {
        diastolicIndex = valley;
        break;
      }
    }
    
    const diastolicTime = diastolicIndex > lastPeakIndex ? 
      (diastolicIndex - lastPeakIndex) * msPerSample : 
      300; // Valor típico si no se encuentra
    
    return {
      perfusion: Math.min(1, Math.max(0, perfusion)),
      dicroticNotchTime,
      systolicPeakTime: 120, // Valor aproximado típico
      diastolicTime,
      risingSlope,
      fallingSlope
    };
  }
  
  /**
   * Encuentra los picos y valles en una señal PPG
   */
  private findPeaksAndValleys(values: number[]): { peaks: number[], valleys: number[] } {
    const peaks: number[] = [];
    const valleys: number[] = [];
    
    // Ignorar los primeros y últimos puntos para evitar falsos positivos
    for (let i = 2; i < values.length - 2; i++) {
      // Detectar picos (máximos locales)
      if (values[i] > values[i - 1] && values[i] > values[i + 1] &&
          values[i] > values[i - 2] && values[i] > values[i + 2]) {
        peaks.push(i);
      }
      // Detectar valles (mínimos locales)
      else if (values[i] < values[i - 1] && values[i] < values[i + 1] &&
               values[i] < values[i - 2] && values[i] < values[i + 2]) {
        valleys.push(i);
      }
    }
    
    return { peaks, valleys };
  }
  
  /**
   * Busca la muesca dicrótica después de un pico sistólico
   */
  private findDicroticNotch(values: number[], peakIndex: number): number {
    if (peakIndex >= values.length - 10) {
      return -1; // No hay suficientes datos después del pico
    }
    
    // Buscar un mínimo local en la ventana después del pico
    // La muesca dicrótica típicamente aparece 200-400 ms después del pico sistólico
    const searchWindowStart = peakIndex + 3;
    const searchWindowEnd = Math.min(peakIndex + 15, values.length - 1);
    
    let notchIndex = -1;
    let minValue = Infinity;
    
    for (let i = searchWindowStart; i < searchWindowEnd; i++) {
      // Buscar un punto que sea menor que sus vecinos inmediatos
      if (values[i] < values[i - 1] && values[i] < values[i + 1] && values[i] < minValue) {
        minValue = values[i];
        notchIndex = i;
      }
    }
    
    return notchIndex;
  }
  
  /**
   * Calcula la pendiente de subida (sístole)
   */
  private calculateRisingSlope(values: number[], peakIndex: number): number {
    if (peakIndex < 5) {
      return 1.0; // Valor por defecto si no hay suficientes datos
    }
    
    // Buscar el valle anterior al pico
    let valleyIndex = peakIndex - 1;
    while (valleyIndex > 0 && values[valleyIndex] >= values[valleyIndex - 1]) {
      valleyIndex--;
    }
    
    // Calcular pendiente normalizada
    const rise = values[peakIndex] - values[valleyIndex];
    const run = peakIndex - valleyIndex;
    
    return run > 0 ? rise / run : 1.0;
  }
  
  /**
   * Calcula la pendiente de bajada (diástole)
   */
  private calculateFallingSlope(values: number[], peakIndex: number): number {
    if (peakIndex >= values.length - 5) {
      return -0.5; // Valor por defecto si no hay suficientes datos
    }
    
    // Buscar el valle posterior al pico
    let valleyIndex = peakIndex + 1;
    while (valleyIndex < values.length - 1 && values[valleyIndex] >= values[valleyIndex + 1]) {
      valleyIndex++;
    }
    
    // Calcular pendiente normalizada
    const fall = values[valleyIndex] - values[peakIndex];
    const run = valleyIndex - peakIndex;
    
    return run > 0 ? fall / run : -0.5;
  }
  
  /**
   * Obtiene valores de características por defecto
   */
  private getDefaultFeatures(): MorphologyFeatures {
    return {
      perfusion: 0.5,
      dicroticNotchTime: 250,
      systolicPeakTime: 120,
      diastolicTime: 300,
      risingSlope: 1.0,
      fallingSlope: -0.5
    };
  }
  
  /**
   * Reinicia el analizador
   */
  public reset(): void {
    // No hay estado persistente que reiniciar
    console.log('Analizador morfológico PPG reiniciado');
  }
}
