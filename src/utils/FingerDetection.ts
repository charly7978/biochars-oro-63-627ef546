
/**
 * Utilidades para la detección de dedos en imágenes de cámara
 * Optimizado para detección PPG
 */

export interface FingerDetectionResult {
  detected: boolean;
  confidence: number;
  metrics: {
    brightness: number;
    redDominance: number;
    redIntensity: number;
    greenIntensity: number;
    blueIntensity: number;
  };
}

export interface DetectionOptions {
  redThreshold?: number;      // Umbral mínimo para el canal rojo
  brightnessThreshold?: number; // Umbral mínimo de brillo general
  redDominanceThreshold?: number; // Diferencia mínima entre canales rojo y otros
  regionSize?: number;        // Tamaño de la región central a analizar (porcentaje)
  adaptiveMode?: boolean;     // Usar modo adaptativo que ajusta umbrales automáticamente
  maxIntensityThreshold?: number; // Umbral máximo para evitar brillos/reflejos
}

// Histórico para estabilización de detección
const detectionHistory: boolean[] = [];
const HISTORY_SIZE = 8; // Reducido para respuesta más rápida
let previousConfidence = 0;

// Tracking de consistencia temporal
let lastDetectionTime = 0;
let consecutiveDetections = 0;
let consecutiveNonDetections = 0;
const REQUIRED_CONSECUTIVE_DETECTIONS = 1; // Reducido a 1 para detección instantánea
const MAX_CONSECUTIVE_NON_DETECTIONS = 2; // Reducido para respuesta más rápida a la eliminación

// Mejora para estabilidad de métricas
const metricsHistory: Array<{
  brightness: number;
  redDominance: number;
  redIntensity: number;
}> = [];
const METRICS_HISTORY_SIZE = 5;

/**
 * Analiza una región de imagen para detectar la presencia de un dedo
 * Utiliza múltiples métricas para una detección más precisa
 */
export function detectFinger(
  imageData: ImageData, 
  options: DetectionOptions = {}
): FingerDetectionResult {
  const {
    redThreshold = 85,              // Reducido para mejor detección con luz ambiente
    brightnessThreshold = 45,       // Reducido para funcionar en condiciones de luz más variadas
    redDominanceThreshold = 20,     // Reducido para mejorar detección
    regionSize = 40,                // Aumentado para capturar mejor la superficie del dedo
    adaptiveMode = true,
    maxIntensityThreshold = 240     // Sin cambios
  } = options;

  const now = Date.now();
  
  // Calcular dimensiones y coordenadas de la región central
  const width = imageData.width;
  const height = imageData.height;
  const regionWidthPx = Math.floor(width * (regionSize / 100));
  const regionHeightPx = Math.floor(height * (regionSize / 100));
  
  const startX = Math.floor((width - regionWidthPx) / 2);
  const startY = Math.floor((height - regionHeightPx) / 2);
  
  let totalRed = 0;
  let totalGreen = 0;
  let totalBlue = 0;
  let pixelCount = 0;
  let maxRed = 0;
  let minRed = 255;
  let brightnessValues: number[] = [];

  // Analizar solo la región central
  for (let y = startY; y < startY + regionHeightPx; y++) {
    for (let x = startX; x < startX + regionWidthPx; x++) {
      const idx = (y * width + x) * 4;
      
      // Verificar límites para evitar errores
      if (idx >= imageData.data.length - 3) continue;
      
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      
      // Acumular valores
      totalRed += r;
      totalGreen += g;
      totalBlue += b;
      
      // Análisis de variación para detección de pulso
      if (r > maxRed) maxRed = r;
      if (r < minRed) minRed = r;
      
      // Track pixel brightness for distribution analysis
      const pixelBrightness = (r + g + b) / 3;
      brightnessValues.push(pixelBrightness);
      
      pixelCount++;
    }
  }
  
  // Si no hay píxeles, no se puede detectar
  if (pixelCount === 0) {
    consecutiveNonDetections++;
    consecutiveDetections = 0;
    return getEmptyResult();
  }

  const avgRed = totalRed / pixelCount;
  const avgGreen = totalGreen / pixelCount;
  const avgBlue = totalBlue / pixelCount;
  const brightness = (avgRed + avgGreen + avgBlue) / 3;
  const redDominance = avgRed - ((avgGreen + avgBlue) / 2);
  
  // Guardar métricas en el historial para estabilidad
  metricsHistory.push({
    brightness,
    redDominance,
    redIntensity: avgRed
  });
  
  if (metricsHistory.length > METRICS_HISTORY_SIZE) {
    metricsHistory.shift();
  }
  
  // Calcular métricas promediadas para mayor estabilidad
  const avgBrightness = metricsHistory.reduce((sum, m) => sum + m.brightness, 0) / metricsHistory.length;
  const avgRedDominance = metricsHistory.reduce((sum, m) => sum + m.redDominance, 0) / metricsHistory.length;
  const avgRedIntensity = metricsHistory.reduce((sum, m) => sum + m.redIntensity, 0) / metricsHistory.length;
  
  // Ratios para detección de dedo - más permisivos
  const redGreenRatio = avgRed / (avgGreen || 1);
  const redBlueRatio = avgRed / (avgBlue || 1);
  
  // Calculate brightness uniformity (important for detecting a finger vs background)
  brightnessValues.sort((a, b) => a - b);
  const medianBrightness = brightnessValues[Math.floor(brightnessValues.length / 2)];
  const q1 = brightnessValues[Math.floor(brightnessValues.length * 0.25)];
  const q3 = brightnessValues[Math.floor(brightnessValues.length * 0.75)];
  const brightnessUniformity = 1 - ((q3 - q1) / (medianBrightness || 1));
  
  // Umbrales adaptativos más permisivos
  let currentRedThreshold = redThreshold;
  let currentBrightnessThreshold = brightnessThreshold;
  let currentRedDominanceThreshold = redDominanceThreshold;
  
  if (adaptiveMode) {
    if (avgBrightness > 180) {
      // Para imágenes muy brillantes, requerir más rojo
      currentRedThreshold *= 1.2;
      currentRedDominanceThreshold *= 1.2;
    } else if (avgBrightness < 60) {
      // Para imágenes oscuras, ser más permisivo
      currentRedThreshold *= 0.8;
      currentBrightnessThreshold *= 0.8;
      currentRedDominanceThreshold *= 0.8;
    }
  }

  // Criterios de detección mejorados
  const isBrightEnough = avgBrightness > currentBrightnessThreshold;
  const isRedDominant = avgRedDominance > currentRedDominanceThreshold;
  const isRedHighest = avgRed > avgGreen * 1.15 && avgRed > avgBlue * 1.15; // Ratios más permisivos
  const isRedIntenseEnough = avgRedIntensity > currentRedThreshold;
  const notTooIntense = avgRed < maxIntensityThreshold && 
                        avgGreen < maxIntensityThreshold && 
                        avgBlue < maxIntensityThreshold;
  
  // Verificación de uniformidad para reducir falsos positivos (más permisiva)
  const isUniform = brightnessUniformity > 0.6;
  
  // Cálculo de confianza mejorado
  let confidence = 0;
  
  if (isBrightEnough) confidence += 20;
  if (isRedDominant) confidence += 25;
  if (isRedHighest) confidence += 25;
  if (isRedIntenseEnough) confidence += 20;
  if (notTooIntense) confidence += 10;
  if (isUniform) confidence += 15;
  if (redGreenRatio > 1.3) confidence += 5;  // Bonificación por ratio rojo/verde
  if (redBlueRatio > 1.5) confidence += 5;   // Bonificación por ratio rojo/azul
  
  confidence = Math.min(100, confidence);
  
  // Criterios de detección más permisivos
  const basicDetection = 
    isBrightEnough && 
    isRedDominant &&
    (isRedHighest || redGreenRatio > 1.3) &&
    isRedIntenseEnough &&
    notTooIntense &&
    isUniform;

  // Detección de emergencia más permisiva para positivos verdaderos
  const emergencyDetection = 
    avgRed > 80 && // Umbral más bajo para detección más sensible
    (isRedHighest || redGreenRatio > 1.3) && 
    avgRedDominance > 25 && 
    avgBrightness > 65 && 
    brightnessUniformity > 0.6;
  
  // Detección con criterios combinados
  let isFingerDetected = basicDetection || emergencyDetection;
  
  // Actualizar historial de detección
  detectionHistory.push(isFingerDetected);
  if (detectionHistory.length > HISTORY_SIZE) {
    detectionHistory.shift();
  }
  
  // Comprobación de consistencia temporal
  if (isFingerDetected) {
    consecutiveDetections++;
    consecutiveNonDetections = 0;
    
    // Solo considerar detectado después de lecturas constantes
    if (consecutiveDetections < REQUIRED_CONSECUTIVE_DETECTIONS) {
      isFingerDetected = false;
    }
  } else {
    consecutiveNonDetections++;
    // Permitir menos fotogramas perdidos antes de considerar que se ha quitado el dedo
    if (consecutiveNonDetections < MAX_CONSECUTIVE_NON_DETECTIONS && 
        consecutiveDetections >= REQUIRED_CONSECUTIVE_DETECTIONS) {
      isFingerDetected = true;
    } else {
      consecutiveDetections = 0;
    }
  }
  
  // Detección estable más permisiva para velocidad
  const stableDetection = 
    detectionHistory.length >= HISTORY_SIZE / 2 &&
    detectionHistory.filter(d => d).length >= Math.floor(detectionHistory.length * 0.5); // Reducido a 50%

  // Aplicar suavizado temporal para estabilidad
  const alpha = 0.3; // Suavizado más reactivo
  previousConfidence = alpha * confidence + (1 - alpha) * previousConfidence;
  const finalConfidence = Math.round(previousConfidence);

  // Decisión final de detección con estabilidad temporal
  const finalDetection = (stableDetection && isFingerDetected) || 
                         (emergencyDetection && consecutiveDetections >= 1); // Ruta rápida para detección fuerte
  
  // Actualizar hora de última detección para referencia futura
  if (finalDetection) {
    lastDetectionTime = now;
  }

  // Debug más detallado
  console.log(`DEDO DEBUG: R:${avgRed.toFixed(0)} G:${avgGreen.toFixed(0)} B:${avgBlue.toFixed(0)} RGratio:${redGreenRatio.toFixed(2)} RBratio:${redBlueRatio.toFixed(2)}`);
  console.log(`CRITERIOS: Bright:${avgBrightness.toFixed(0)}/${currentBrightnessThreshold.toFixed(0)} RedDom:${avgRedDominance.toFixed(0)}/${currentRedDominanceThreshold.toFixed(0)} Unif:${brightnessUniformity.toFixed(2)}`);
  console.log(`DETECCIÓN: Basic:${basicDetection} Emergency:${emergencyDetection} Final:${finalDetection} Conf:${finalConfidence}`);

  return {
    detected: finalDetection,
    confidence: finalConfidence,
    metrics: {
      brightness: avgBrightness,
      redDominance: avgRedDominance,
      redIntensity: avgRedIntensity,
      greenIntensity: avgGreen,
      blueIntensity: avgBlue
    }
  };
}

// Helper function for empty result
function getEmptyResult(): FingerDetectionResult {
  return {
    detected: false,
    confidence: 0,
    metrics: {
      brightness: 0,
      redDominance: 0,
      redIntensity: 0,
      greenIntensity: 0,
      blueIntensity: 0
    }
  };
}

/**
 * Determina la calidad de la señal PPG basándose en múltiples métricas
 * @param detectionResult - Resultado de la detección de dedo
 * @returns Calidad de señal en porcentaje (0-100)
 */
export function calculateSignalQuality(detectionResult: FingerDetectionResult): number {
  if (!detectionResult.detected) {
    return 0;
  }
  
  const { metrics } = detectionResult;
  
  // Cálculo de calidad mejorado
  
  // Factor de dominancia de rojo (ideal: >20)
  const redDominanceFactor = Math.min(100, Math.max(0, (metrics.redDominance / 30) * 100));
  
  // Factor de brillo (ideal: 100-180 en escala 0-255)
  const idealBrightness = 140;
  const brightnessDeviation = Math.abs(metrics.brightness - idealBrightness);
  const brightnessFactor = Math.max(0, 100 - (brightnessDeviation / 1.2));
  
  // Factor de intensidad de rojo (ideal: 100-180 en escala 0-255)
  const redIntensityFactor = metrics.redIntensity < 100 ? 
    Math.min(90, (metrics.redIntensity / 100) * 90) : 
    Math.min(100, (1 - (metrics.redIntensity - 100) / 80) * 100);
  
  // Factor de contraste rojo-verde (importante para señal PPG)
  const redGreenContrastFactor = Math.min(100, Math.max(0, 
    (metrics.redIntensity - metrics.greenIntensity) * 3.0));
  
  // Fórmula ponderada equilibrada
  const quality = (
    redDominanceFactor * 0.35 +     // Énfasis en dominancia de rojo
    brightnessFactor * 0.35 +       // Mayor peso para brillo adecuado
    redIntensityFactor * 0.15 +  
    redGreenContrastFactor * 0.15
  );
  
  // Aplicar umbral mínimo más alto para mejor calidad de señal
  return Math.max(50, Math.round(quality));
}
