
/**
 * Utilidades y algoritmos para procesamiento de señales PPG
 * Basado en investigación científica y algoritmos validados
 */

// Funciones para detección y análisis de picos
export const PPGAnalysis = {
  /**
   * Detecta picos en una señal PPG
   * @param values - Valores de la señal PPG
   * @param minPeakDistance - Distancia mínima entre picos (en muestras)
   * @returns - Índices de los picos detectados
   */
  findPeaks(values: number[], minPeakDistance: number = 5): number[] {
    if (values.length < 3) return [];
    
    const peaks: number[] = [];
    
    // Eliminar valores iniciales para evitar falsos positivos
    const startIdx = Math.min(5, Math.floor(values.length * 0.1));
    
    for (let i = startIdx; i < values.length - 1; i++) {
      // Un punto es un pico si es mayor que sus vecinos
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
        // Verificar si es realmente un pico significativo
        let isPeak = true;
        
        // Comprobar ventana más amplia para picos más robustos
        const windowSize = 2; // 2 puntos a cada lado
        for (let j = Math.max(0, i - windowSize); j < i; j++) {
          if (values[i] < values[j]) {
            isPeak = false;
            break;
          }
        }
        
        for (let j = i + 1; j <= Math.min(values.length - 1, i + windowSize); j++) {
          if (values[i] < values[j]) {
            isPeak = false;
            break;
          }
        }
        
        // Verificar distancia mínima con el pico anterior
        if (isPeak && (peaks.length === 0 || i - peaks[peaks.length - 1] >= minPeakDistance)) {
          peaks.push(i);
        }
      }
    }
    
    return peaks;
  },
  
  /**
   * Calcula el ritmo cardíaco a partir de picos detectados
   * @param peakIndices - Índices de los picos
   * @param samplingRate - Tasa de muestreo en Hz
   * @returns - Frecuencia cardíaca en BPM
   */
  calculateHeartRateFromPeaks(peakIndices: number[], samplingRate: number = 30): number {
    if (peakIndices.length < 2) return 0;
    
    // Calcular intervalos entre picos
    const intervals: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      intervals.push(peakIndices[i] - peakIndices[i - 1]);
    }
    
    // Eliminar intervalos atípicos (fuera de rango fisiológico)
    const validIntervals = intervals.filter(interval => {
      const bpm = 60 * samplingRate / interval;
      return bpm >= 40 && bpm <= 200; // Rango fisiológico normal
    });
    
    if (validIntervals.length === 0) return 0;
    
    // Calcular media de intervalos válidos
    const meanInterval = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    
    // Convertir a BPM
    return Math.round(60 * samplingRate / meanInterval);
  },
  
  /**
   * Detecta arritmias basado en la variabilidad de intervalos RR
   * @param peakIndices - Índices de los picos
   * @param samplingRate - Tasa de muestreo en Hz
   * @returns - Objeto con análisis de arritmias
   */
  detectArrhythmias(peakIndices: number[], samplingRate: number = 30): {
    hasArrhythmia: boolean;
    confidence: number;
    details: string;
  } {
    if (peakIndices.length < 5) {
      return { 
        hasArrhythmia: false, 
        confidence: 0,
        details: "Datos insuficientes" 
      };
    }
    
    // Calcular intervalos RR (tiempo entre picos)
    const rrIntervals: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const rrMs = (peakIndices[i] - peakIndices[i - 1]) * (1000 / samplingRate);
      rrIntervals.push(rrMs);
    }
    
    // Calcular variabilidad de intervalos RR (SDNN)
    const meanRR = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
    const sdnn = Math.sqrt(
      rrIntervals.reduce((sum, val) => sum + Math.pow(val - meanRR, 2), 0) / rrIntervals.length
    );
    
    // Calcular pNN50 (porcentaje de intervalos consecutivos que difieren en más de 50ms)
    let nn50Count = 0;
    for (let i = 1; i < rrIntervals.length; i++) {
      if (Math.abs(rrIntervals[i] - rrIntervals[i - 1]) > 50) {
        nn50Count++;
      }
    }
    const pNN50 = (rrIntervals.length > 1) ? (nn50Count / (rrIntervals.length - 1)) * 100 : 0;
    
    // Detectar intervalos muy irregulares (posibles arritmias)
    let irregularIntervals = 0;
    for (let i = 0; i < rrIntervals.length; i++) {
      // Un intervalo es irregular si difiere más del 20% de la media
      if (Math.abs(rrIntervals[i] - meanRR) > (meanRR * 0.2)) {
        irregularIntervals++;
      }
    }
    
    const irregularityPercentage = (rrIntervals.length > 0) ? 
      (irregularIntervals / rrIntervals.length) * 100 : 0;
    
    // Análisis de resultado
    let hasArrhythmia = false;
    let confidence = 0;
    let details = "Normal";
    
    if (irregularityPercentage > 30 || pNN50 > 40 || sdnn > 100) {
      hasArrhythmia = true;
      
      // Calcular confianza basada en múltiples métricas
      confidence = Math.min(
        100, 
        (irregularityPercentage * 0.5) + (pNN50 * 0.3) + (Math.min(100, sdnn) * 0.2)
      ) / 100;
      
      // Categorizar tipo de arritmia
      if (irregularityPercentage > 50 && pNN50 > 60) {
        details = "Fibrilación auricular posible";
      } else if (irregularityPercentage > 40) {
        details = "Arritmia irregular";
      } else {
        details = "Variabilidad cardíaca elevada";
      }
    }
    
    return {
      hasArrhythmia,
      confidence,
      details
    };
  },
  
  /**
   * Calcula índices de perfusión y oxigenación
   * @param values - Valores de la señal PPG
   * @returns - Índices calculados
   */
  calculateIndices(values: number[]): {
    perfusionIndex: number;
    acComponent: number;
    dcComponent: number;
  } {
    if (values.length < 10) {
      return { perfusionIndex: 0, acComponent: 0, dcComponent: 0 };
    }
    
    // Calcular componentes AC y DC
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    const dcComponent = (min + max) / 2; // Componente DC (valor medio)
    const acComponent = max - min; // Componente AC (variación pico a pico)
    
    // Calcular índice de perfusión (PI = AC/DC * 100%)
    const perfusionIndex = dcComponent !== 0 ? (acComponent / dcComponent) * 100 : 0;
    
    return {
      perfusionIndex: Math.min(perfusionIndex, 10), // Limitar a 10% máximo
      acComponent,
      dcComponent
    };
  },
  
  /**
   * Estima la saturación de oxígeno (SpO2) a partir de índices de perfusión
   * @param redPerfusion - Índice de perfusión del canal rojo
   * @param irPerfusion - Índice de perfusión del canal infrarrojo
   * @returns - Estimación de SpO2 (%)
   */
  estimateSpO2(redPerfusion: number, irPerfusion: number = 0): number {
    // Si no hay datos IR, usar aproximación solo con rojo
    if (irPerfusion <= 0) {
      // Aproximación basada únicamente en perfusión del canal rojo
      // (Esta es una aproximación simplificada, no tan precisa como la ratio R/IR)
      if (redPerfusion <= 0) return 0;
      
      // La perfusión mayor generalmente indica mejor oxigenación
      // (Limitada precisión, solo para demostración)
      const baseSpO2 = 95; // Base de referencia normal
      
      // Ajustar basado en perfusión (mejor perfusión = mayor SpO2)
      // Limitado a rango fisiológico
      let adjustment = Math.min(3, Math.max(-15, (redPerfusion - 1.5) * 2));
      
      return Math.min(100, Math.max(70, Math.round(baseSpO2 + adjustment)));
    }
    
    // Cálculo tradicional con ratio R usando ambos canales
    // R = (AC_red/DC_red)/(AC_ir/DC_ir)
    const R = (redPerfusion / irPerfusion);
    
    // Ecuación empírica para SpO2
    // SpO2 = 110 - 25 * R (aproximación simplificada)
    const spO2 = Math.round(110 - (25 * R));
    
    // Limitar a rango fisiológico
    return Math.min(100, Math.max(70, spO2));
  }
};

// Constantes y parámetros para el análisis de PPG
export const PPGConstants = {
  // Tasas de muestreo típicas
  SAMPLING_RATES: {
    LOW: 20,    // Hz, mínimo recomendado
    MEDIUM: 30, // Hz, estándar para móviles
    HIGH: 60    // Hz, alta precisión
  },
  
  // Rangos fisiológicos
  PHYSIOLOGICAL_RANGES: {
    HEART_RATE: {
      MIN: 40,   // BPM, mínimo en reposo
      MAX: 200   // BPM, máximo en ejercicio intenso
    },
    SPO2: {
      MIN: 70,   // %, valor mínimo detectable
      NORMAL: 95, // %, valor normal
      MAX: 100    // %, valor máximo
    },
    PERFUSION_INDEX: {
      POOR: 0.5,  // %, perfusión débil
      NORMAL: 2.0, // %, perfusión normal
      STRONG: 5.0  // %, perfusión fuerte
    }
  },
  
  // Parámetros de filtrado
  FILTER_PARAMS: {
    // Frecuencias de corte para filtro pasabanda (Hz)
    BANDPASS: {
      LOW_CUTOFF: 0.5,  // Remove baseline wander
      HIGH_CUTOFF: 5.0  // Remove high frequency noise
    },
    
    // Parámetros para filtro de media móvil
    MOVING_AVERAGE: {
      WINDOW_SIZE: 5  // Tamaño de ventana
    },
    
    // Parámetros para filtro de mediana
    MEDIAN_FILTER: {
      WINDOW_SIZE: 3  // Tamaño de ventana
    }
  },
  
  // Valores de umbral para detección
  THRESHOLDS: {
    // Calidad de señal
    SIGNAL_QUALITY: {
      POOR: 30,     // Por debajo, señal no confiable
      ACCEPTABLE: 50, // Mínimo para análisis básico
      GOOD: 70       // Buena para análisis avanzado
    },
    
    // Perfusión
    PERFUSION: {
      MIN_DETECTABLE: 0.1, // Mínimo para detección confiable
      MIN_FOR_SPO2: 0.3    // Mínimo para análisis de SpO2
    }
  }
};
