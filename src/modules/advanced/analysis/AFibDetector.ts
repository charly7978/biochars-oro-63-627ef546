
/**
 * Detector avanzado de fibrilación auricular basado en análisis
 * de irregularidad de intervalos entre pulsos.
 * 
 * NOTA IMPORTANTE: Este módulo implementa técnicas avanzadas manteniendo
 * compatibilidad con las interfaces principales en index.tsx y PPGSignalMeter.tsx.
 */

export class AFibDetector {
  // Configuración basada en investigaciones médicas recientes
  private readonly RMSSD_THRESHOLD = 45; // Umbral de RMSSD para detección de AFib
  private readonly POINCARE_SD1_THRESHOLD = 35; // Umbral de SD1 para AFib
  private readonly MIN_RR_INTERVALS = 8; // Mínimo de intervalos para análisis confiable
  
  // Parámetros avanzados de detección
  private readonly SAMPLE_ENTROPY_THRESHOLD = 1.2; // Umbral de entropía muestral
  private readonly CV_THRESHOLD = 0.15; // Coeficiente de variación umbral
  private readonly TURNING_POINT_RATIO_THRESHOLD = 0.6; // Ratio de puntos de inflexión
  
  // Estado del detector
  private arrhythmiaCount: number = 0;
  private consecutiveDetections: number = 0;
  private lastDetectionTime: number = 0;
  private MIN_TIME_BETWEEN_DETECTIONS = 3000; // 3 segundos entre detecciones
  private MAX_DETECTIONS_SESSION = 10; // Máximo de detecciones por sesión
  
  constructor() {
    console.log('Detector de Fibrilación Auricular inicializado');
  }
  
  /**
   * Analiza intervalos RR para detectar patrones de fibrilación auricular
   */
  public analyze(rrIntervals: number[]): {
    detected: boolean;
    confidence: number;
    count: number;
    metrics: {
      rmssd: number;
      poincareSd1: number;
      sampleEntropy: number;
      turningPointRatio: number;
    };
  } {
    // Verificar si tenemos suficientes intervalos para análisis confiable
    if (!rrIntervals || rrIntervals.length < this.MIN_RR_INTERVALS) {
      return {
        detected: false,
        confidence: 0,
        count: this.arrhythmiaCount,
        metrics: {
          rmssd: 0,
          poincareSd1: 0,
          sampleEntropy: 0,
          turningPointRatio: 0
        }
      };
    }
    
    // Usar sólo intervalos fisiológicamente plausibles (filtrar outliers)
    const validIntervals = this.filterValidIntervals(rrIntervals);
    
    if (validIntervals.length < this.MIN_RR_INTERVALS) {
      return {
        detected: false,
        confidence: 0,
        count: this.arrhythmiaCount,
        metrics: {
          rmssd: 0,
          poincareSd1: 0,
          sampleEntropy: 0,
          turningPointRatio: 0
        }
      };
    }
    
    // Calcular métricas de variabilidad cardíaca
    const rmssd = this.calculateRMSSD(validIntervals);
    const poincareSd1 = this.calculatePoincareSD1(validIntervals);
    const sampleEntropy = this.calculateSampleEntropy(validIntervals);
    const turningPointRatio = this.calculateTurningPointRatio(validIntervals);
    
    // Algoritmo multi-parámetro para detección de AFib
    const isRmssdElevated = rmssd > this.RMSSD_THRESHOLD;
    const isPoincareSd1Elevated = poincareSd1 > this.POINCARE_SD1_THRESHOLD;
    const isEntropyElevated = sampleEntropy > this.SAMPLE_ENTROPY_THRESHOLD;
    const isTurningPointHigh = turningPointRatio > this.TURNING_POINT_RATIO_THRESHOLD;
    
    // Cálculo de confianza basado en múltiples parámetros
    const confidenceFactors = [
      isRmssdElevated ? 0.35 : 0,
      isPoincareSd1Elevated ? 0.3 : 0,
      isEntropyElevated ? 0.2 : 0,
      isTurningPointHigh ? 0.15 : 0
    ];
    
    // Confianza total
    const confidence = confidenceFactors.reduce((sum, factor) => sum + factor, 0);
    
    // Determinar si se detecta fibrilación
    const afibDetected = confidence >= 0.65;
    
    // Gestionar detecciones consecutivas para reducir falsos positivos
    const currentTime = Date.now();
    
    if (afibDetected) {
      this.consecutiveDetections++;
      
      // Actualizar contador sólo si ha pasado suficiente tiempo desde la última detección
      // y no hemos excedido el máximo de detecciones por sesión
      if (this.consecutiveDetections >= 2 && 
          currentTime - this.lastDetectionTime > this.MIN_TIME_BETWEEN_DETECTIONS &&
          this.arrhythmiaCount < this.MAX_DETECTIONS_SESSION) {
        this.arrhythmiaCount++;
        this.lastDetectionTime = currentTime;
        
        console.log('AFib detectada', {
          confidence,
          rmssd,
          poincareSd1,
          sampleEntropy,
          count: this.arrhythmiaCount
        });
      }
    } else {
      // Reducir gradualmente detecciones consecutivas
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
    }
    
    return {
      detected: afibDetected,
      confidence,
      count: this.arrhythmiaCount,
      metrics: {
        rmssd,
        poincareSd1,
        sampleEntropy,
        turningPointRatio
      }
    };
  }
  
  /**
   * Filtra intervalos RR válidos, eliminando outliers fisiológicos
   */
  private filterValidIntervals(rrIntervals: number[]): number[] {
    if (rrIntervals.length < 3) return rrIntervals;
    
    // Calcular estadísticas básicas
    const sorted = [...rrIntervals].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length / 4);
    const q3Index = Math.floor(3 * sorted.length / 4);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    // Límites para detección de outliers
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    // Filtrar sólo intervalos fisiológicamente plausibles
    return rrIntervals.filter(rr => 
      rr >= Math.max(300, lowerBound) && 
      rr <= Math.min(1500, upperBound)
    );
  }
  
  /**
   * Calcula RMSSD (Root Mean Square of Successive Differences)
   * Métrica estándar para variabilidad cardíaca a corto plazo
   */
  private calculateRMSSD(rrIntervals: number[]): number {
    if (rrIntervals.length < 2) return 0;
    
    let sumSquaredDiff = 0;
    
    for (let i = 1; i < rrIntervals.length; i++) {
      const diff = rrIntervals[i] - rrIntervals[i-1];
      sumSquaredDiff += diff * diff;
    }
    
    return Math.sqrt(sumSquaredDiff / (rrIntervals.length - 1));
  }
  
  /**
   * Calcula SD1 del diagrama de Poincaré
   * Refleja variabilidad cardíaca a corto plazo
   */
  private calculatePoincareSD1(rrIntervals: number[]): number {
    if (rrIntervals.length < 2) return 0;
    
    // SD1 está relacionado con RMSSD
    return this.calculateRMSSD(rrIntervals) / Math.sqrt(2);
  }
  
  /**
   * Implementación simplificada de entropía muestral
   * para detección de irregularidad en la señal
   */
  private calculateSampleEntropy(rrIntervals: number[]): number {
    if (rrIntervals.length < 4) return 0;
    
    // Normalizar valores
    const mean = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
    const std = Math.sqrt(
      rrIntervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rrIntervals.length
    );
    
    const normalized = rrIntervals.map(val => (val - mean) / std);
    
    // Parámetros para SampEn
    const m = 2;  // Longitud del patrón
    const r = 0.2; // Tolerancia
    
    // Contar coincidencias para patrones de longitud m y m+1
    let countM = 0;
    let countM1 = 0;
    
    // Para cada punto, contar patrones similares
    for (let i = 0; i < normalized.length - m; i++) {
      for (let j = i + 1; j < normalized.length - m; j++) {
        // Verificar similitud para patrón de longitud m
        let matchM = true;
        
        for (let k = 0; k < m; k++) {
          if (Math.abs(normalized[i + k] - normalized[j + k]) > r) {
            matchM = false;
            break;
          }
        }
        
        if (matchM) {
          countM++;
          
          // Verificar similitud para patrón de longitud m+1
          if (i < normalized.length - m - 1 && j < normalized.length - m - 1) {
            if (Math.abs(normalized[i + m] - normalized[j + m]) <= r) {
              countM1++;
            }
          }
        }
      }
    }
    
    // Prevenir divisiones por cero
    if (countM === 0 || countM1 === 0) {
      return 0;
    }
    
    // Calcular SampEn
    return -Math.log(countM1 / countM);
  }
  
  /**
   * Calcula el ratio de puntos de inflexión (turning points)
   * Alto en fibrilación auricular debido a la irregularidad
   */
  private calculateTurningPointRatio(rrIntervals: number[]): number {
    if (rrIntervals.length < 4) return 0;
    
    let turningPoints = 0;
    
    for (let i = 1; i < rrIntervals.length - 1; i++) {
      // Un punto de inflexión es un máximo o mínimo local
      if ((rrIntervals[i] > rrIntervals[i-1] && rrIntervals[i] > rrIntervals[i+1]) ||
          (rrIntervals[i] < rrIntervals[i-1] && rrIntervals[i] < rrIntervals[i+1])) {
        turningPoints++;
      }
    }
    
    // El máximo teórico es 2/3 de la longitud para una secuencia aleatoria
    const theoreticalMax = 2 * (rrIntervals.length - 2) / 3;
    
    return turningPoints / theoreticalMax;
  }
  
  /**
   * Reinicia el estado del detector
   * @param fullReset Si es true, reinicia también el contador de arritmias
   */
  public reset(fullReset: boolean = true): void {
    this.consecutiveDetections = 0;
    this.lastDetectionTime = 0;
    
    if (fullReset) {
      this.arrhythmiaCount = 0;
    }
  }
}
