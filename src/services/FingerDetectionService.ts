
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { KalmanFilter } from '../core/signal/filters/KalmanFilter';
import { BandpassFilter } from '../core/signal/filters/BandpassFilter';
import { toast } from 'sonner';
import { 
  calculateSNR, 
  calculateAutocorrelation, 
  detectArtifacts, 
  evaluateSignalStability 
} from '../modules/vital-signs/utils/signal-analysis-utils';

// Interfaz para configuración
export interface FingerDetectionConfig {
  // Umbrales de calidad
  minSignalAmplitude: number; // Mínima amplitud PPG (valores estrictos)
  minQualityThreshold: number; // Umbral mínimo de calidad global
  
  // Parámetros para detección de patrones rítmicos
  rhythmPatternWindowMs: number; // Ventana para análisis de ritmo
  minPeaksForRhythm: number; // Mínimo de picos para confirmar ritmo
  peakDetectionThreshold: number; // Umbral para detección de picos
  requiredConsistentPatterns: number; // Patrones consistentes para confirmar dedo
  minSignalVariance: number; // Varianza mínima para evitar señales planas
  minPeakIntervalMs: number; // Intervalo mínimo entre picos cardíacos
  maxPeakIntervalMs: number; // Intervalo máximo entre picos cardíacos
  maxIntervalDeviationMs: number; // Máxima desviación permitida entre intervalos
  
  // Parámetros de OpenCV
  openCvMinSkinConfidence: number; // Umbral mínimo para detección de piel
  openCvMinContourArea: number; // Área mínima del contorno de dedo (pixels²)
  
  // Parámetros de análisis avanzado
  snrThreshold: number; // Umbral mínimo de SNR en dB
  minAutocorrelation: number; // Correlación mínima para señal periódica
  maxArtifactPercentage: number; // Máximo % de artefactos permitido
  
  // Sistema de histéresis
  hysteresisWindowMs: number; // Ventana para histéresis
  requiredFramesForActivation: number; // Frames para confirmar presencia de dedo
  requiredFramesForDeactivation: number; // Frames para confirmar ausencia
}

// Resultado de la detección
export interface FingerDetectionResult {
  isFingerDetected: boolean;
  quality: number; // Calidad general (0-100)
  confidence: number; // Confianza general (0-1)
  rhythmDetected: boolean; // Si se detectó patrón rítmico
  rhythmConfidence: number; // Confianza del ritmo (0-1)
  signalStrength: number; // Fuerza de señal
  feedback?: string; // Mensajes para el usuario
  roi?: { x: number; y: number; width: number; height: number }; // ROI detectada
  skinConfidence?: number; // Confianza de detección de piel
  contourQuality?: number; // Calidad del contorno detectado
  lastUpdate: number;
  
  // Métricas avanzadas
  snr?: number; // Signal to Noise Ratio en dB
  periodicityScore?: number; // 0-1, qué tan periódica es la señal
  artifactPercentage?: number; // % de la señal con artefactos
  signalStability?: number; // Estabilidad de la señal (0-1)
}

/**
 * Sistema avanzado de detección de dedos utilizando múltiples factores de validación
 * Prohíbe cualquier tipo de simulación - solo usa datos reales y medidos
 */
class FingerDetectionManager {
  private static instance: FingerDetectionManager;
  private kalmanFilter: KalmanFilter;
  private bandpassFilter: BandpassFilter;
  
  // Histórico de señales para análisis
  private signalHistory: Array<{ time: number, value: number }> = [];
  private readonly PPG_HISTORY_SIZE_MS = 5000; 

  // Seguimiento de patrones rítmicos
  private detectedRhythmicPatternsCount: number = 0;
  private fingerConfirmedByRhythm: boolean = false;
  private lastPeakTimes: number[] = [];
  
  // Variables internas
  private lastProcessedPpgValue: number = 0;
  private lastDetectionResult: FingerDetectionResult | null = null;
  
  // Histéresis
  private fingerPresentFrames: number = 0;
  private fingerAbsentFrames: number = 0;
  private lastHysteresisState: boolean = false;
  private hysteresisBuffer: boolean[] = [];
  
  // OpenCV
  private openCvInitialized: boolean = false;
  private cvReady: boolean = false;
  
  // Configuración con valores estrictos y basados en evidencia científica
  private config: FingerDetectionConfig = {
    // Umbrales básicos
    minSignalAmplitude: 0.015, // Más estricto que antes
    minQualityThreshold: 40, // Umbral de calidad más alto
    
    // Parámetros para ritmo
    rhythmPatternWindowMs: 3000,
    minPeaksForRhythm: 5, // Incrementado para más precisión
    peakDetectionThreshold: 0.12, // Más exigente
    requiredConsistentPatterns: 5, // Más patrones requeridos
    minSignalVariance: 0.008, // Incrementado
    minPeakIntervalMs: 350,  // ~170 BPM (max razonable)
    maxPeakIntervalMs: 1500, // ~40 BPM (min razonable)
    maxIntervalDeviationMs: 120, // Reducido para mejor detección
    
    // OpenCV
    openCvMinSkinConfidence: 0.75, // Más exigente
    openCvMinContourArea: 625, // Al menos 25x25 píxeles
    
    // Parámetros avanzados
    snrThreshold: 6.5, // dB - umbral de señal limpia
    minAutocorrelation: 0.45, // Mayor exigencia de periodicidad
    maxArtifactPercentage: 18, // Max % artefactos permitido
    
    // Histéresis
    hysteresisWindowMs: 1000, // Ventana de 1 segundo
    requiredFramesForActivation: 5, // Más frames para confirmar presencia
    requiredFramesForDeactivation: 8  // Se requieren más frames para confirmar ausencia
  };

  private constructor() {
    // Inicialización de filtros
    this.kalmanFilter = new KalmanFilter();
    // Parámetros optimizados para detección de señal digital PPG
    this.kalmanFilter.setParameters(0.08, 0.03); // Q (processNoise), R (measurementNoise) - optimizados
    this.bandpassFilter = new BandpassFilter(0.5, 4, 30); // Aísla señales entre 0.5-4Hz (30-240 BPM)
    console.log("FingerDetectionManager: Inicializado con parámetros estrictos");
    
    // Intentar inicializar OpenCV
    this.initializeOpenCV();
  }

  /**
   * Método para inicializar OpenCV cuando esté disponible
   */
  private async initializeOpenCV(): Promise<void> {
    try {
      // Verificar si OpenCV ya está disponible
      if (typeof window !== 'undefined' && 'cv' in window) {
        this.openCvInitialized = true;
        this.cvReady = true;
        console.log("FingerDetectionManager: OpenCV ya está disponible");
        return;
      }
      
      // Intentar cargar OpenCV dinámicamente
      if (typeof window !== 'undefined') {
        console.log("FingerDetectionManager: Intentando cargar OpenCV dinámicamente");
        
        // Verificar si existe el script de OpenCV
        const existingScript = document.querySelector('script[src*="opencv"]');
        
        if (!existingScript) {
          const script = document.createElement('script');
          script.src = 'https://docs.opencv.org/4.7.0/opencv.js';
          
          // Manejar eventos de carga
          script.onload = () => {
            if (window.cv && typeof window.cv === 'object') {
              console.log("FingerDetectionManager: OpenCV cargado correctamente");
              this.openCvInitialized = true;
              this.cvReady = true;
            } else {
              console.error("FingerDetectionManager: OpenCV cargado pero no disponible correctamente");
            }
          };
          
          script.onerror = () => {
            console.error("FingerDetectionManager: Error cargando OpenCV");
          };
          
          document.head.appendChild(script);
        }
      }
    } catch (error) {
      console.error("FingerDetectionManager: Error inicializando OpenCV", error);
    }
  }

  public static getInstance(): FingerDetectionManager {
    if (!FingerDetectionManager.instance) {
      FingerDetectionManager.instance = new FingerDetectionManager();
    }
    return FingerDetectionManager.instance;
  }

  public updateConfig(newConfig: Partial<FingerDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("FingerDetectionManager: Config actualizada", this.config);
  }

  /**
   * Método principal para procesar imagen y señal PPG
   * Solo retorna dedo detectado si TODOS los factores superan umbrales estrictos
   */
  public processFrameAndSignal(
    imageData?: ImageData, // Para OpenCV
    ppgValue?: number, // Para análisis de señal
    cvReady?: boolean // Indica si OpenCV está listo
  ): FingerDetectionResult {
    const currentTime = Date.now();
    
    // Si tenemos nuevo estado de OpenCV, actualizamos
    if (cvReady !== undefined) {
      this.cvReady = cvReady;
    }

    // Procesar la señal PPG (si se proporciona)
    let ppgFilteredValue = 0;
    let ppgMetrics = {
      snr: 0,
      periodicity: 0,
      artifacts: 100,
      stability: 0
    };
    
    if (ppgValue !== undefined) {
      // Aplicar filtros en cascada
      const kalmanFiltered = this.kalmanFilter.filter(ppgValue);
      ppgFilteredValue = this.bandpassFilter.filter(kalmanFiltered);
      this.lastProcessedPpgValue = ppgFilteredValue;

      // Guardar en el historial
      this.signalHistory.push({ time: currentTime, value: ppgFilteredValue });
      // Mantener solo el historial necesario
      this.signalHistory = this.signalHistory.filter(
        point => currentTime - point.time < this.PPG_HISTORY_SIZE_MS
      );
      
      // Extraer valores planos para análisis
      const recentValues = this.signalHistory.map(p => p.value);
      
      // Calcular métricas avanzadas
      if (recentValues.length > 20) {
        ppgMetrics = {
          snr: calculateSNR(recentValues),
          periodicity: calculateAutocorrelation(recentValues),
          artifacts: detectArtifacts(recentValues),
          stability: evaluateSignalStability(recentValues)
        };
      }
    } else {
      // Si no hay nuevo valor PPG, usar el último procesado para consistencia
      ppgFilteredValue = this.signalHistory.length > 0 
        ? this.signalHistory[this.signalHistory.length - 1].value 
        : 0;
    }
    
    // 1. Detección de Patrón Rítmico
    const rhythmResult = this.detectRhythmicPatternInternal();
    this.fingerConfirmedByRhythm = rhythmResult.isPatternConsistent;
    
    // Seguimiento de patrones consistentes (con histéresis)
    if (rhythmResult.isPatternConsistent) {
      this.detectedRhythmicPatternsCount = Math.min(
        this.config.requiredConsistentPatterns + 2, 
        this.detectedRhythmicPatternsCount + 1
      );
    } else {
      this.detectedRhythmicPatternsCount = Math.max(
        0, 
        this.detectedRhythmicPatternsCount - 0.5
      );
    }
    
    const finalRhythmConfirmed = 
      this.detectedRhythmicPatternsCount >= this.config.requiredConsistentPatterns;


    // 2. Análisis de Imagen con OpenCV (cuando esté disponible)
    let openCvResults = {
      roiDetected: undefined as FingerDetectionResult['roi'],
      skinConfidence: undefined as FingerDetectionResult['skinConfidence'],
      contourQuality: undefined as FingerDetectionResult['contourQuality']
    };
    
    if (imageData && this.cvReady) {
      openCvResults = this.analyzeImageWithOpenCV(imageData);
    }


    // 3. Cálculo de Calidad de Señal PPG (sistema multifactorial)
    const ppgQuality = this.calculatePpgSignalQuality(
      ppgFilteredValue,
      ppgMetrics.snr,
      ppgMetrics.periodicity,
      ppgMetrics.artifacts
    );


    // 4. Sistema de Confianza Ponderado Multifactorial
    const overallConfidence = this.calculateOverallConfidence({
      rhythmConfidence: rhythmResult.confidence,
      rhythmConfirmed: finalRhythmConfirmed,
      ppgQuality,
      signalMetrics: ppgMetrics,
      cvResults: openCvResults
    });

    // 5. Sistema de Histéresis para estabilizar la detección
    const isFingerActuallyDetected = this.applyHysteresis(
      overallConfidence >= 0.65,
      currentTime
    );

    // 6. Generar Feedback para el usuario
    const feedback = this.generateUserFeedback({
      isDetected: isFingerActuallyDetected,
      quality: ppgQuality,
      rhythmConfirmed: finalRhythmConfirmed,
      metrics: ppgMetrics,
      cv: openCvResults
    });
    
    // Generar resultado final completo
    const result: FingerDetectionResult = {
      isFingerDetected: isFingerActuallyDetected,
      quality: ppgQuality,
      confidence: overallConfidence,
      rhythmDetected: finalRhythmConfirmed,
      rhythmConfidence: rhythmResult.confidence,
      signalStrength: Math.abs(ppgFilteredValue),
      feedback,
      roi: openCvResults.roiDetected,
      skinConfidence: openCvResults.skinConfidence,
      contourQuality: openCvResults.contourQuality,
      lastUpdate: currentTime,
      
      // Métricas avanzadas
      snr: ppgMetrics.snr,
      periodicityScore: ppgMetrics.periodicity,
      artifactPercentage: ppgMetrics.artifacts,
      signalStability: ppgMetrics.stability
    };
    
    // Guardar el último resultado
    this.lastDetectionResult = result;
    
    return result;
  }
  
  /**
   * Sistema avanzado de detección de patrones rítmicos en la señal PPG
   */
  private detectRhythmicPatternInternal(): { 
    isPatternConsistent: boolean; 
    confidence: number; 
    peaksFound: number[] 
  } {
    const currentTime = Date.now();
    const recentSignalData = this.signalHistory.filter(
      point => currentTime - point.time < this.config.rhythmPatternWindowMs
    );

    if (recentSignalData.length < 20) {
      return { isPatternConsistent: false, confidence: 0, peaksFound: [] };
    }

    const values = recentSignalData.map(s => s.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    // Rechazo temprano si la varianza es demasiado baja (señal plana)
    if (variance < this.config.minSignalVariance) {
      return { isPatternConsistent: false, confidence: 0.1, peaksFound: [] };
    }

    // Detección avanzada de picos con validación de forma
    const peaks: { time: number; value: number }[] = [];
    
    // 1. Detectar picos candidatos
    for (let i = 2; i < recentSignalData.length - 2; i++) {
      const p = recentSignalData[i];
      
      // Verificar si es un máximo local
      if (
        p.value > recentSignalData[i - 1].value &&
        p.value > recentSignalData[i - 2].value &&
        p.value >= recentSignalData[i + 1].value &&
        p.value >= recentSignalData[i + 2].value &&
        Math.abs(p.value) > this.config.peakDetectionThreshold
      ) {
        // Validación adicional de forma de la onda
        const preSlope = p.value - recentSignalData[i - 2].value;
        const postSlope = p.value - recentSignalData[i + 2].value;
        
        // Un pico cardíaco real debería tener pendientes significativas en ambos lados
        if (preSlope > 0.01 && postSlope > 0.01) {
          peaks.push(p);
        }
      }
    }
    
    this.lastPeakTimes = peaks.map(p => p.time);

    // Si no hay suficientes picos, no podemos tener un ritmo
    if (peaks.length < this.config.minPeaksForRhythm) {
      const partialConfidence = 0.2 + (0.1 * peaks.length / this.config.minPeaksForRhythm);
      return { 
        isPatternConsistent: false, 
        confidence: Math.min(0.5, partialConfidence), 
        peaksFound: this.lastPeakTimes 
      };
    }

    // Calcular intervalos entre picos
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i].time - peaks[i - 1].time);
    }

    // Filtrar intervalos fisiológicamente plausibles
    const validIntervals = intervals.filter(
      interval => interval >= this.config.minPeakIntervalMs && 
                  interval <= this.config.maxPeakIntervalMs
    );

    if (validIntervals.length < this.config.minPeaksForRhythm - 1) {
      const partialConfidence = 0.3 + (0.1 * validIntervals.length / (this.config.minPeaksForRhythm - 1));
      return { 
        isPatternConsistent: false, 
        confidence: Math.min(0.5, partialConfidence), 
        peaksFound: this.lastPeakTimes 
      };
    }

    // Verificar consistencia de intervalos (ritmo regular)
    let consistentIntervalCount = 0;
    if (validIntervals.length >= 1) consistentIntervalCount = 1; 

    for (let i = 1; i < validIntervals.length; i++) {
      if (Math.abs(validIntervals[i] - validIntervals[i - 1]) < this.config.maxIntervalDeviationMs) {
        consistentIntervalCount++;
      }
    }
    
    // Confianza basada en consistencia de intervalos
    const rhythmConfidence = (validIntervals.length > 0) 
      ? (consistentIntervalCount / validIntervals.length) * 0.85 + 0.15 
      : 0.2;

    // Determinar si tenemos un ritmo cardíaco verdadero
    if (consistentIntervalCount >= this.config.minPeaksForRhythm - 1) {
      return { 
        isPatternConsistent: true, 
        confidence: Math.max(0.6, rhythmConfidence), 
        peaksFound: this.lastPeakTimes 
      };
    }
    
    return { 
      isPatternConsistent: false, 
      confidence: rhythmConfidence, 
      peaksFound: this.lastPeakTimes 
    };
  }

  /**
   * Integración con OpenCV para análisis de imagen
   * Detecta piel humana y contornos de dedo
   */
  private analyzeImageWithOpenCV(imageData: ImageData): {
    roiDetected?: { x: number; y: number; width: number; height: number };
    skinConfidence?: number;
    contourQuality?: number;
  } {
    // Verificar que OpenCV esté disponible
    if (!this.cvReady || typeof window === 'undefined' || !window.cv) {
      return {
        roiDetected: undefined,
        skinConfidence: undefined,
        contourQuality: undefined
      };
    }

    try {
      const cv = window.cv;
      
      // Convertir ImageData a mat
      const src = cv.matFromImageData(imageData);
      
      // ROI para análisis (centro de la imagen)
      const centerX = Math.floor(src.cols / 2);
      const centerY = Math.floor(src.rows / 2);
      const roiWidth = Math.floor(src.cols * 0.6);
      const roiHeight = Math.floor(src.rows * 0.6);
      const roiX = Math.max(0, centerX - Math.floor(roiWidth / 2));
      const roiY = Math.max(0, centerY - Math.floor(roiHeight / 2));
      
      // Recortar ROI
      const roi = new cv.Rect(roiX, roiY, 
                             Math.min(roiWidth, src.cols - roiX), 
                             Math.min(roiHeight, src.rows - roiY));
      const roiMat = src.roi(roi);
      
      // Convertir a HSV para mejor detección de piel
      const hsvMat = new cv.Mat();
      cv.cvtColor(roiMat, hsvMat, cv.COLOR_RGBA2RGB);
      cv.cvtColor(hsvMat, hsvMat, cv.COLOR_RGB2HSV);
      
      // Crear máscara para detección de piel (rango HSV típico para piel humana)
      const lowerBound = new cv.Mat(1, 3, cv.CV_8UC1);
      const upperBound = new cv.Mat(1, 3, cv.CV_8UC1);
      
      // Rangos HSV optimizados para detectar piel humana
      lowerBound.data[0] = 0;   // Hue min 
      lowerBound.data[1] = 15;  // Saturation min
      lowerBound.data[2] = 40;  // Value min
      
      upperBound.data[0] = 25;  // Hue max
      upperBound.data[1] = 170; // Saturation max
      upperBound.data[2] = 255; // Value max
      
      // Crear máscara de piel
      const skinMask = new cv.Mat();
      cv.inRange(hsvMat, lowerBound, upperBound, skinMask);
      
      // Operaciones morfológicas para limpiar la máscara
      const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
      const cleanMask = new cv.Mat();
      
      // Primero dilatación para cerrar huecos pequeños
      cv.dilate(skinMask, cleanMask, kernel, new cv.Point(-1, -1), 1);
      // Luego erosión para eliminar pequeños puntos aislados
      cv.erode(cleanMask, cleanMask, kernel, new cv.Point(-1, -1), 1);
      
      // Encontrar contornos en la máscara
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(cleanMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      
      // Variables para almacenar el mejor contorno (más grande y más similar a un dedo)
      let maxArea = 0;
      let bestContourIndex = -1;
      let bestContourQuality = 0;
      
      // Evaluar cada contorno
      for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        
        // Solo considerar contornos lo suficientemente grandes
        if (area > this.config.openCvMinContourArea) {
          // Calcular perímetro y aproximar contorno
          const perimeter = cv.arcLength(contour, true);
          const approxCurve = new cv.Mat();
          cv.approxPolyDP(contour, approxCurve, 0.02 * perimeter, true);
          
          // Calcular factor de compacidad (circularity) - un dedo tendrá un valor específico
          const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
          
          // Factor de aspecto (ratio ancho/alto) - un dedo es más largo que ancho
          const boundingRect = cv.boundingRect(contour);
          const aspectRatio = boundingRect.width / boundingRect.height;
          
          // Combinar métricas para obtener calidad de contorno para "forma de dedo"
          // Un dedo típico tiene circularity de ~0.4-0.7 y aspectRatio < 1
          let contourQuality = 0;
          
          if (circularity > 0.3 && circularity < 0.85) {
            contourQuality += 0.5;
          } else if (circularity > 0.2 && circularity < 0.95) {
            contourQuality += 0.3;
          }
          
          if (aspectRatio < 1.0) {
            contourQuality += 0.5;
          } else if (aspectRatio < 1.3) {
            contourQuality += 0.3;
          }
          
          // Preferir contornos grandes con buena calidad
          const weightedArea = area * contourQuality;
          
          if (weightedArea > maxArea) {
            maxArea = weightedArea;
            bestContourIndex = i;
            bestContourQuality = contourQuality;
          }
          
          approxCurve.delete();
        }
      }
      
      // Calcular porcentaje de pixeles de piel en ROI para confianza
      const totalPixels = cleanMask.rows * cleanMask.cols;
      const skinPixels = cv.countNonZero(cleanMask);
      const skinPercentage = skinPixels / totalPixels;
      
      // Limpiar memoria de OpenCV
      src.delete();
      roiMat.delete();
      hsvMat.delete();
      lowerBound.delete();
      upperBound.delete();
      skinMask.delete();
      kernel.delete();
      cleanMask.delete();
      hierarchy.delete();
      
      // Si no se encontró un contorno adecuado, devolver sin ROI
      if (bestContourIndex === -1) {
        contours.delete();
        return {
          roiDetected: undefined,
          skinConfidence: skinPercentage,
          contourQuality: 0
        };
      }
      
      // Calcular el rectángulo delimitador del mejor contorno
      const bestContour = contours.get(bestContourIndex);
      const boundingRect = cv.boundingRect(bestContour);
      
      // Ajustar coordenadas absolutas
      const absoluteRect = {
        x: roiX + boundingRect.x,
        y: roiY + boundingRect.y,
        width: boundingRect.width,
        height: boundingRect.height
      };
      
      contours.delete();
      
      return {
        roiDetected: absoluteRect,
        skinConfidence: skinPercentage,
        contourQuality: bestContourQuality
      };
      
    } catch (error) {
      console.error("OpenCV Error:", error);
      return {
        roiDetected: undefined,
        skinConfidence: undefined,
        contourQuality: undefined
      };
    }
  }

  /**
   * Análisis multifactorial de la calidad de señal PPG
   */
  private calculatePpgSignalQuality(
    currentFilteredValue: number,
    snr: number = 0,
    periodicity: number = 0,
    artifactPercentage: number = 100
  ): number {
    // Si no hay historial suficiente, calidad cero
    const history = this.signalHistory.map(p => p.value);
    if (history.length < 30) return 0;

    // --- Métricas de calidad ---

    // 1. Amplitud (25%)
    const range = Math.max(...history) - Math.min(...history);
    let amplitudeScore = Math.min(1, range / (this.config.minSignalAmplitude * 3));
    
    // Rechazo si amplitud mínima no se cumple
    if (range < this.config.minSignalAmplitude * 0.5) {
      amplitudeScore = 0;
    }

    // 2. SNR - Signal-to-Noise Ratio (30%)
    const snrMaxReference = 30; // dB, valor óptimo
    const snrScore = Math.min(1, Math.max(0, snr / snrMaxReference));
    
    // 3. Periodicidad - indica presencia de pulso regular (25%)
    const periodicityScore = periodicity; // Ya normalizado entre 0-1
    
    // 4. Artefactos - movimiento u otras interferencias (20%)
    const artifactScore = 1 - (artifactPercentage / 100);

    // Ponderación de métricas
    let weightedQuality =
      (amplitudeScore * 25) +
      (snrScore * 30) +
      (periodicityScore * 25) +
      (artifactScore * 20);
    
    // Convertir a escala 0-100
    let finalQuality = Math.round(weightedQuality);
    
    // Mejorar calidad si tenemos detección de ritmo confirmada
    if (this.fingerConfirmedByRhythm) {
      const rhythmBoost = Math.min(15, (this.detectedRhythmicPatternsCount / this.config.requiredConsistentPatterns) * 15);
      finalQuality = Math.min(100, finalQuality + rhythmBoost);
    }
    
    // Aplicar umbrales mínimos
    if (range < this.config.minSignalAmplitude * 0.7) {
      finalQuality = Math.min(finalQuality, 30);
    }
    if (snr < this.config.snrThreshold * 0.5) {
      finalQuality = Math.min(finalQuality, 20);
    }
    if (periodicity < this.config.minAutocorrelation * 0.5) {
      finalQuality = Math.min(finalQuality, 25);
    }

    return Math.max(0, Math.min(100, finalQuality));
  }

  /**
   * Sistema avanzado de confianza ponderada multifactorial
   */
  private calculateOverallConfidence({
    rhythmConfidence,
    rhythmConfirmed,
    ppgQuality,
    signalMetrics,
    cvResults
  }: {
    rhythmConfidence: number;
    rhythmConfirmed: boolean;
    ppgQuality: number;
    signalMetrics: {
      snr: number;
      periodicity: number;
      artifacts: number;
      stability: number;
    };
    cvResults: {
      roiDetected?: { x: number; y: number; width: number; height: number };
      skinConfidence?: number;
      contourQuality?: number;
    };
  }): number {
    let totalWeightedScore = 0;
    let totalWeights = 0;

    // 1. Calidad de Ritmo Cardíaco (40%)
    const rhythmWeight = 40;
    let rhythmScore = rhythmConfidence;
    if (!rhythmConfirmed) {
      rhythmScore *= 0.5;
    }
    totalWeightedScore += (rhythmScore * rhythmWeight);
    totalWeights += rhythmWeight;

    // 2. Calidad de la Señal PPG (35%)
    const ppgQualityWeight = 35;
    totalWeightedScore += ((ppgQuality / 100) * ppgQualityWeight);
    totalWeights += ppgQualityWeight;

    // 3. Confianza de OpenCV (25% cuando está disponible)
    const opencvWeight = 25;
    
    if (cvResults.roiDetected && cvResults.skinConfidence !== undefined) {
      // 3.1 Confianza de detección de piel
      const skinWeight = 15;
      let skinScore = cvResults.skinConfidence;
      
      if (skinScore < this.config.openCvMinSkinConfidence) {
        skinScore *= 0.5;
      }
      
      totalWeightedScore += (skinScore * skinWeight);
      totalWeights += skinWeight;
      
      // 3.2 Calidad del contorno de dedo
      if (cvResults.contourQuality !== undefined) {
        const contourWeight = 10;
        totalWeightedScore += (cvResults.contourQuality * contourWeight);
        totalWeights += contourWeight;
      }
    }

    // Penalización por problemas graves detectados
    // 1. SNR demasiado bajo
    if (signalMetrics.snr < this.config.snrThreshold) {
      totalWeightedScore *= 0.8;
    }
    
    // 2. Demasiados artefactos
    if (signalMetrics.artifacts > this.config.maxArtifactPercentage) {
      totalWeightedScore *= 0.8;
    }
    
    // 3. Señal demasiado plana o amplitud insuficiente
    const range = Math.max(...this.signalHistory.map(p => p.value)) - 
                  Math.min(...this.signalHistory.map(p => p.value));
    
    if (range < this.config.minSignalAmplitude) {
      totalWeightedScore *= 0.7;
    }
    
    // Cláusula de rechazo absoluto si varios factores críticos fallan
    if (ppgQuality < 25 && signalMetrics.periodicity < 0.2 && !rhythmConfirmed) {
      totalWeightedScore = 0;
    }
    
    // Normalizar confianza final
    return totalWeights > 0 ? 
      Math.min(1, Math.max(0, totalWeightedScore / totalWeights / 100)) : 0;
  }

  /**
   * Sistema de histéresis para estabilizar detección y evitar intermitencia
   */
  private applyHysteresis(currentDetection: boolean, currentTime: number): boolean {
    // Añadir la detección actual al buffer de histéresis
    this.hysteresisBuffer.push(currentDetection);
    
    // Mantener solo las detecciones dentro de la ventana de tiempo de histéresis
    const hysteresisWindowMs = this.config.hysteresisWindowMs;
    const bufferSize = Math.max(10, this.config.requiredFramesForActivation + 2);
    
    if (this.hysteresisBuffer.length > bufferSize) {
      this.hysteresisBuffer.shift();
    }
    
    // Calcular número de frames positivos/negativos en el buffer
    const positiveFrames = this.hysteresisBuffer.filter(frame => frame).length;
    const negativeFrames = this.hysteresisBuffer.length - positiveFrames;
    
    // Aplicar histéresis 
    if (this.lastHysteresisState) {
      // Ya estábamos detectando dedo - requiere más frames negativos para cambiar de estado
      if (negativeFrames >= this.config.requiredFramesForDeactivation) {
        this.lastHysteresisState = false;
      }
    } else {
      // No estábamos detectando dedo - requiere suficientes frames positivos para cambiar
      if (positiveFrames >= this.config.requiredFramesForActivation) {
        this.lastHysteresisState = true;
      }
    }
    
    return this.lastHysteresisState;
  }

  /**
   * Generación de feedback específico para el usuario
   */
  private generateUserFeedback({
    isDetected, 
    quality, 
    rhythmConfirmed,
    metrics,
    cv
  }: {
    isDetected: boolean;
    quality: number;
    rhythmConfirmed: boolean;
    metrics: {
      snr: number;
      periodicity: number;
      artifacts: number;
      stability: number;
    };
    cv: {
      roiDetected?: { x: number; y: number; width: number; height: number };
      skinConfidence?: number;
      contourQuality?: number;
    };
  }): string {
    if (isDetected) return "Dedo detectado correctamente";

    // Si no está detectado, proporcionar feedback específico sobre el problema
    
    // 1. Problemas con la señal PPG
    if (this.signalHistory.length < 30) {
      return "Posicione el dedo sobre la cámara...";
    }
    
    const range = Math.max(...this.signalHistory.map(p => p.value)) - 
                  Math.min(...this.signalHistory.map(p => p.value));
    
    if (range < this.config.minSignalAmplitude * 0.7) {
      return "Señal muy débil. Presione suavemente sobre la cámara.";
    }
    
    // 2. Problemas con el ritmo cardíaco
    if (!rhythmConfirmed && metrics.periodicity < this.config.minAutocorrelation) {
      if (this.lastPeakTimes.length < this.config.minPeaksForRhythm) {
        return "Pocos pulsos detectados. Mantenga el dedo quieto.";
      }
      return "Ritmo cardíaco irregular. Mantenga el dedo firme.";
    }
    
    // 3. Problemas de calidad de señal
    if (metrics.artifacts > this.config.maxArtifactPercentage) {
      return "Movimiento detectado. Mantenga el dedo inmóvil.";
    }
    
    if (metrics.snr < this.config.snrThreshold) {
      return "Señal con ruido. Mejore la posición del dedo.";
    }
    
    // 4. Problemas de visión por computadora (si está disponible)
    if (cv.skinConfidence !== undefined && cv.skinConfidence < this.config.openCvMinSkinConfidence) {
      return "Asegúrese que el dedo cubra completamente la cámara.";
    }
    
    if (cv.contourQuality !== undefined && cv.contourQuality < 0.5) {
      return "Forma no reconocida. Coloque la yema del dedo sobre la cámara.";
    }
    
    // Mensaje general si ninguna causa específica es detectada
    return "Coloque el dedo correctamente sobre la cámara.";
  }

  /**
   * Resetea todos los estados internos del detector de dedos
   */
  public reset(): void {
    this.signalHistory = [];
    this.kalmanFilter.reset();
    this.bandpassFilter.reset();
    this.detectedRhythmicPatternsCount = 0;
    this.fingerConfirmedByRhythm = false;
    this.lastPeakTimes = [];
    this.lastProcessedPpgValue = 0;
    this.lastDetectionResult = null;
    this.fingerPresentFrames = 0;
    this.fingerAbsentFrames = 0;
    this.lastHysteresisState = false;
    this.hysteresisBuffer = [];
    console.log("FingerDetectionManager: Reset completo");
  }
}

// Exportar la instancia singleton
export const fingerDetectionManager = FingerDetectionManager.getInstance();
