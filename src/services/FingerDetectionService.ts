/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import cv from '@techstark/opencv-js';
import { calculateSNR, evaluateSignalStability } from '@/hooks/heart-beat/signal-processing/signal-quality';

// Define a simple autocorrelation function since it's missing from the utilities
function calculateAutocorrelation(signal: number[]): number {
  if (signal.length < 10) return 0;

  // Simple implementation of autocorrelation for periodicity detection
  let sumCorr = 0;
  let sumNorm = 0;
  const mean = signal.reduce((sum, val) => sum + val, 0) / signal.length;
  const normalizedSignal = signal.map(val => val - mean);
  
  // Calculate autocorrelation for half the signal length lags
  for (let lag = 1; lag < Math.floor(signal.length / 2); lag++) {
    let corr = 0;
    for (let i = 0; i < signal.length - lag; i++) {
      corr += normalizedSignal[i] * normalizedSignal[i + lag];
    }
    sumCorr += Math.abs(corr);
    sumNorm += 1;
  }
  
  // Normalize to get a value between 0-1
  return sumNorm > 0 ? Math.min(1, Math.abs(sumCorr) / (signal.length * sumNorm)) : 0;
}

interface FingerDetectionConfig {
  // Umbrales de color para detección de piel en espacio HSV
  skinLowerBound: [number, number, number];
  skinUpperBound: [number, number, number];
  
  // Umbrales de parámetros para la detección confiable
  minContourArea: number;
  minQuality: number;
  periodicityThreshold: number;
  signalStabilityThreshold: number;
  
  // Histéresis para evitar detección intermitente
  hysteresisBuffer: number;
  confidenceThreshold: number;
  
  // Factores de ponderación para detección multifactorial
  signalQualityWeight: number;
  periodicityWeight: number;
  skinDetectionWeight: number;
  contourQualityWeight: number;
  stabilityWeight: number;
}

export interface FingerDetectionResult {
  isFingerDetected: boolean;
  quality: number;
  confidence: number;
  feedback: string;
  roi?: { x: number, y: number, width: number, height: number };
  signalValue?: number;
  skinConfidence: number;
  contourQuality: number;
  periodicityScore?: number;
  stabilityScore?: number;
}

class FingerDetectionService {
  private config: FingerDetectionConfig = {
    skinLowerBound: [0, 40, 60],     // Valores ajustados más estrictos
    skinUpperBound: [25, 255, 255],  // Valores ajustados más estrictos
    minContourArea: 5000,           // Área mínima más grande para evitar falsos positivos
    minQuality: 40,
    periodicityThreshold: 0.4,
    signalStabilityThreshold: 0.5,
    hysteresisBuffer: 5,
    confidenceThreshold: 0.6,
    signalQualityWeight: 0.3,
    periodicityWeight: 0.3,
    skinDetectionWeight: 0.2,
    contourQualityWeight: 0.1,
    stabilityWeight: 0.1
  };

  private recentDetectionStates: boolean[] = [];
  private signalBuffer: number[] = [];
  private lastDetectionResult: FingerDetectionResult | null = null;
  private consecutiveStableFrames: number = 0;
  private cvReady: boolean = false;
  private recentValues: number[] = [];
  private lastUpdateTime: number = 0;
  private signalHistory: number[] = [];
  
  // Buffer para OpenCV ROI
  private lastROIs: Array<{ x: number, y: number, width: number, height: number }> = [];
  
  // Variables para estadísticas de detección
  private detectionStats = {
    totalFrames: 0,
    detectedFrames: 0,
    averageQuality: 0,
    lastResetTime: Date.now()
  };

  constructor() {
    console.log("FingerDetectionService: Inicializado con configuración óptima para detección real.");
    
    // Verificar si OpenCV está disponible
    this.checkOpenCVAvailability();
  }

  /**
   * Verifica si OpenCV está disponible y listo para usar
   */
  private checkOpenCVAvailability(): void {
    if (typeof cv !== 'undefined' && cv.getBuildInformation) {
      console.log("OpenCV está disponible");
      this.cvReady = true;
    } else {
      console.log("OpenCV no está disponible todavía, verificando nuevamente...");
      setTimeout(() => this.checkOpenCVAvailability(), 500);
    }
  }

  /**
   * Procesa un frame para detectar la presencia de un dedo
   * @param imageData Datos de imagen del frame de video
   * @param signalValue Valor opcional de señal PPG
   * @param useOpenCV Indica si usar OpenCV para análisis avanzado
   * @returns Resultado de la detección con datos de confianza
   */
  public processFrameAndSignal(
    imageData?: ImageData,
    signalValue?: number,
    useOpenCV: boolean = true
  ): FingerDetectionResult {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;
    this.lastUpdateTime = now;

    // Actualizar estadísticas de detección
    this.detectionStats.totalFrames++;
    
    // Sistema de detección multifactorial
    let signalQualityScore = 0;
    let periodicityScore = 0;
    let stabilityScore = 0;
    let skinConfidence = 0;
    let contourQuality = 0;
    let detectedROI: { x: number, y: number, width: number, height: number } | null = null;
    
    // 1. ANÁLISIS DE SEÑAL si hay valor de señal proporcionado
    if (signalValue !== undefined) {
      // Actualizar el buffer de señal
      this.signalBuffer.push(signalValue);
      if (this.signalBuffer.length > 150) {
        this.signalBuffer.shift();
      }
      
      // Calculo de calidad de señal basado en SNR
      if (this.signalBuffer.length >= 30) {
        signalQualityScore = Math.min(1, calculateSNR(this.signalBuffer.slice(-30)) / 20);
      }
      
      // Análisis de periodicidad con autocorrelación
      if (this.signalBuffer.length >= 100) {
        periodicityScore = calculateAutocorrelation(this.signalBuffer.slice(-100));
      }
      
      // Análisis de estabilidad temporal
      if (this.signalBuffer.length >= 50) {
        stabilityScore = evaluateSignalStability(this.signalBuffer.slice(-50));
      }
    }
    
    // 2. ANÁLISIS DE IMAGEN si hay imagen proporcionada y OpenCV está disponible
    const openCVResult = imageData && useOpenCV && this.cvReady 
      ? this.processImageWithOpenCV(imageData)
      : { 
          roiDetected: null as any,
          skinConfidence: 0,
          contourQuality: 0
        };
    
    if (openCVResult && openCVResult.roiDetected) {
      detectedROI = openCVResult.roiDetected;
      skinConfidence = openCVResult.skinConfidence;
      contourQuality = openCVResult.contourQuality;
      
      // Actualizar el buffer de ROIs para estabilidad
      this.lastROIs.push(openCVResult.roiDetected);
      if (this.lastROIs.length > 5) {
        this.lastROIs.shift();
      }
    }
    
    // 3. CÁLCULO DE SCORE PONDERADO MULTIFACTORIAL
    // Usar sistema de ponderación para combinar todos los factores
    const scoreWeights = this.config;
    
    const weightedScore = 
      (signalQualityScore * scoreWeights.signalQualityWeight) +
      (periodicityScore * scoreWeights.periodicityWeight) +
      (skinConfidence * scoreWeights.skinDetectionWeight) +
      (contourQuality * scoreWeights.contourQualityWeight) +
      (stabilityScore * scoreWeights.stabilityWeight);
    
    // Normalizar a escala 0-100
    const quality = Math.round(weightedScore * 100);
    
    // 4. DETERMINAR DETECCIÓN CON SISTEMA DE HISTÉRESIS
    // Sistema de histéresis para evitar detección intermitente
    const confidenceScore = weightedScore;
    const rawDetection = confidenceScore >= this.config.confidenceThreshold;
    
    // Aplicar histéresis
    this.recentDetectionStates.push(rawDetection);
    if (this.recentDetectionStates.length > this.config.hysteresisBuffer) {
      this.recentDetectionStates.shift();
    }
    
    // Calcular proporción de detecciones positivas en el buffer de histéresis
    const positiveDetections = this.recentDetectionStates.filter(state => state).length;
    const detectionRatio = positiveDetections / Math.max(1, this.recentDetectionStates.length);
    
    // Determinar detección final usando histéresis
    let isFingerDetected = false;
    
    if (this.lastDetectionResult) {
      // Si ya estaba detectando, mantener detección con un umbral más bajo
      isFingerDetected = this.lastDetectionResult.isFingerDetected
        ? detectionRatio >= 0.4  // Mantener detección con 40% positivas
        : detectionRatio >= 0.7; // Iniciar detección con 70% positivas
    } else {
      isFingerDetected = detectionRatio >= 0.7;
    }
    
    // Incrementar contador de frames estables
    if (isFingerDetected) {
      this.consecutiveStableFrames++;
      this.detectionStats.detectedFrames++;
    } else {
      this.consecutiveStableFrames = 0;
    }
    
    // Actualizar calidad promedio
    this.detectionStats.averageQuality = 
      (this.detectionStats.averageQuality * (this.detectionStats.totalFrames - 1) + quality) / 
      this.detectionStats.totalFrames;
    
    // 5. PREPARAR RESULTADO FINAL
    // Determinar ROI final - usar promedio de últimos ROIs para estabilidad
    let finalROI = detectedROI;
    if (!finalROI && this.lastROIs.length > 0) {
      // Usar el último ROI detectado si no hay uno nuevo
      finalROI = this.lastROIs[this.lastROIs.length - 1];
    }
    
    // Generar feedback específico para el usuario
    let feedback = "Buscando dedo...";
    if (isFingerDetected) {
      if (quality > 80) {
        feedback = "Señal óptima";
      } else if (quality > 60) {
        feedback = "Buena señal";
      } else if (quality > 40) {
        feedback = "Señal adecuada";
      } else {
        feedback = "Señal débil, ajuste la posición";
      }
    } else if (signalQualityScore > 0.2) {
      feedback = "Detectado movimiento, mantenga el dedo quieto";
    } else if (skinConfidence > 0.3) {
      feedback = "Dedo detectado pero con mala señal";
    }
    
    // Preparar resultado final
    const result: FingerDetectionResult = {
      isFingerDetected,
      quality,
      confidence: confidenceScore,
      feedback,
      roi: finalROI,
      signalValue,
      skinConfidence,
      contourQuality,
      periodicityScore,
      stabilityScore
    };
    
    // Guardar para histéresis
    this.lastDetectionResult = result;
    
    return result;
  }

  /**
   * Procesa una imagen con OpenCV para detectar color de piel y contorno del dedo
   * @param imageData Datos de la imagen a procesar
   * @returns Resultado del análisis con OpenCV
   */
  private processImageWithOpenCV(imageData: ImageData): {
    roiDetected: { x: number, y: number, width: number, height: number };
    skinConfidence: number;
    contourQuality: number;
  } {
    if (!this.cvReady) {
      return {
        roiDetected: { x: 0, y: 0, width: 0, height: 0 },
        skinConfidence: 0,
        contourQuality: 0
      };
    }
    
    let srcMat: any = null;
    let rgbMat: any = null;
    let hsvMat: any = null;
    let skinMask: any = null;
    let contours: any = null;
    let hierarchy: any = null;
    
    try {
      // Convertir imagen a formato OpenCV
      srcMat = cv.matFromImageData(imageData);
      rgbMat = new cv.Mat();
      cv.cvtColor(srcMat, rgbMat, cv.COLOR_RGBA2RGB);
      
      // Convertir a espacio de color HSV para mejor detección de piel
      hsvMat = new cv.Mat();
      cv.cvtColor(rgbMat, hsvMat, cv.COLOR_RGB2HSV);
      
      // Crear máscara para detección de color de piel
      skinMask = new cv.Mat();
      const lowerSkin = new cv.Mat(hsvMat.rows, hsvMat.cols, hsvMat.type(), 
                                  this.config.skinLowerBound);
      const upperSkin = new cv.Mat(hsvMat.rows, hsvMat.cols, hsvMat.type(), 
                                  this.config.skinUpperBound);
      
      // Aplicar máscara de color
      cv.inRange(hsvMat, lowerSkin, upperSkin, skinMask);
      
      // Aplicar operaciones morfológicas para mejorar la detección
      const kernel = cv.Mat.ones(5, 5, cv.CV_8U);
      const morphDst = new cv.Mat();
      cv.morphologyEx(skinMask, morphDst, cv.MORPH_OPEN, kernel, new cv.Point(-1, -1), 1);
      cv.morphologyEx(morphDst, skinMask, cv.MORPH_CLOSE, kernel, new cv.Point(-1, -1), 1);
      
      // Encontrar contornos
      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(skinMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      
      // Liberar matrices temporales
      lowerSkin.delete();
      upperSkin.delete();
      morphDst.delete();
      kernel.delete();
      
      // Buscar contorno más grande (probablemente el dedo)
      let largestContourArea = 0;
      let largestContourIndex = -1;
      
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        
        if (area > largestContourArea) {
          largestContourArea = area;
          largestContourIndex = i;
        }
      }
      
      // Verificar si encontramos un contorno adecuado
      if (largestContourIndex === -1 || largestContourArea < this.config.minContourArea) {
        throw new Error("No se detectó un contorno de dedo válido");
      }
      
      // Calcular el rectángulo delimitador
      const largestContour = contours.get(largestContourIndex);
      const boundingRect = cv.boundingRect(largestContour);
      
      // Calcular métricas de calidad para el contorno
      
      // 1. Relación de aspecto (más cerca de 1.5-2.5 es mejor para un dedo)
      const aspectRatio = boundingRect.width / boundingRect.height;
      const aspectScore = 1 - Math.min(1, Math.abs(aspectRatio - 2.0) / 1.5);
      
      // 2. Porcentaje de pixeles de piel en el rectángulo
      const roiMask = skinMask.roi(boundingRect);
      const totalPixels = boundingRect.width * boundingRect.height;
      const skinPixels = cv.countNonZero(roiMask);
      const skinRatio = skinPixels / totalPixels;
      
      // 3. Convexidad del contorno (un dedo debería ser más convexo)
      const hull = new cv.Mat();
      cv.convexHull(largestContour, hull, false, true);
      const hullArea = cv.contourArea(hull);
      const convexityRatio = largestContourArea / Math.max(1, hullArea);
      hull.delete();
      
      // Calcular métricas finales
      const skinConfidence = Math.min(1, (skinRatio * 0.7) + (aspectScore * 0.3));
      const contourQuality = Math.min(1, (convexityRatio * 0.5) + (aspectScore * 0.3) + 
                                  (Math.min(1, largestContourArea / 20000) * 0.2));
      
      // Limpiar
      roiMask.delete();
      
      // Devolver resultado
      return {
        roiDetected: {
          x: boundingRect.x,
          y: boundingRect.y,
          width: boundingRect.width,
          height: boundingRect.height
        },
        skinConfidence,
        contourQuality
      };
      
    } catch (error) {
      console.warn("Error en el procesamiento de OpenCV:", error);
      return {
        roiDetected: { x: 0, y: 0, width: 0, height: 0 },
        skinConfidence: 0,
        contourQuality: 0
      };
    } finally {
      // Limpiar recursos
      if (srcMat) srcMat.delete();
      if (rgbMat) rgbMat.delete();
      if (hsvMat) hsvMat.delete();
      if (skinMask) skinMask.delete();
      if (contours) contours.delete();
      if (hierarchy) hierarchy.delete();
    }
  }

  /**
   * Reinicia el estado del detector de dedos
   */
  public reset(): void {
    this.recentDetectionStates = [];
    this.signalBuffer = [];
    this.lastDetectionResult = null;
    this.consecutiveStableFrames = 0;
    this.lastROIs = [];
    
    // Resetear estadísticas
    this.detectionStats = {
      totalFrames: 0,
      detectedFrames: 0,
      averageQuality: 0,
      lastResetTime: Date.now()
    };
    
    console.log("FingerDetectionService: Estado reiniciado");
  }

  /**
   * Obtiene estadísticas de la detección
   */
  public getStats(): any {
    const runTime = (Date.now() - this.detectionStats.lastResetTime) / 1000;
    return {
      ...this.detectionStats,
      runTimeSeconds: runTime,
      detectionRate: this.detectionStats.totalFrames > 0 
        ? (this.detectionStats.detectedFrames / this.detectionStats.totalFrames) * 100 
        : 0
    };
  }
}

// Crear una instancia singleton
export const fingerDetectionManager = new FingerDetectionService();
