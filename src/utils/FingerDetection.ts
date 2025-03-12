
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

// Histórico para estabilización de detección - increased size for better stability
const detectionHistory: boolean[] = [];
const HISTORY_SIZE = 10;
let previousConfidence = 0;

// Nuevo: Tracking de consistencia temporal
let lastDetectionTime = 0;
let consecutiveDetections = 0;
let consecutiveNonDetections = 0;
const REQUIRED_CONSECUTIVE_DETECTIONS = 2;
const MAX_CONSECUTIVE_NON_DETECTIONS = 6;

/**
 * Analiza una región de imagen para detectar la presencia de un dedo
 * Utiliza múltiples métricas para una detección más precisa
 */
export function detectFinger(
  imageData: ImageData, 
  options: DetectionOptions = {}
): FingerDetectionResult {
  const {
    redThreshold = 65,             
    brightnessThreshold = 35,      
    redDominanceThreshold = 15,    
    regionSize = 40,               
    adaptiveMode = true,
    maxIntensityThreshold = 235    
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

  // Analizar solo la región central
  for (let y = startY; y < startY + regionHeightPx; y++) {
    for (let x = startX; x < startX + regionWidthPx; x++) {
      const idx = (y * width + x) * 4;
      
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
      
      pixelCount++;
    }
  }
  
  // Si no hay píxeles, no se puede detectar
  if (pixelCount === 0) {
    console.log("FingerDetection: No hay píxeles para analizar");
    consecutiveNonDetections++;
    consecutiveDetections = 0;
    return getEmptyResult();
  }

  const avgRed = totalRed / pixelCount;
  const avgGreen = totalGreen / pixelCount;
  const avgBlue = totalBlue / pixelCount;
  const brightness = (avgRed + avgGreen + avgBlue) / 3;
  const redDominance = avgRed - ((avgGreen + avgBlue) / 2);
  
  // Ratios for finger detection
  const redGreenRatio = avgRed / (avgGreen || 1);
  const redBlueRatio = avgRed / (avgBlue || 1);
  
  // Umbrales adaptativos
  let currentRedThreshold = redThreshold;
  let currentBrightnessThreshold = brightnessThreshold;
  let currentRedDominanceThreshold = redDominanceThreshold;
  
  if (adaptiveMode) {
    if (brightness > 180) {
      currentRedThreshold *= 1.3;
      currentRedDominanceThreshold *= 1.4;
    } else if (brightness < 80) {
      currentRedThreshold *= 0.8;
      currentBrightnessThreshold *= 0.8;
      currentRedDominanceThreshold *= 0.8;
    }
  }

  // Simplified detection criteria - removido skin color detection
  const isBrightEnough = brightness > currentBrightnessThreshold;
  const isRedDominant = redDominance > currentRedDominanceThreshold;
  const isRedHighest = avgRed > avgGreen * 1.1 && avgRed > avgBlue * 1.2;
  const isRedIntenseEnough = avgRed > currentRedThreshold;
  const notTooIntense = avgRed < maxIntensityThreshold && 
                        avgGreen < maxIntensityThreshold && 
                        avgBlue < maxIntensityThreshold;
  
  // Red variation for pulse detection
  const redVariation = maxRed - minRed;
  const hasGoodVariation = redVariation > 5;
  
  // Simplified confidence calculation - sin parámetros de skin color
  let confidence = 0;
  
  if (isBrightEnough) confidence += 20;
  if (isRedDominant) confidence += 25;
  if (isRedHighest) confidence += 25;
  if (isRedIntenseEnough) confidence += 20;
  if (notTooIntense) confidence += 10;
  if (hasGoodVariation) confidence += 15; // Mayor importancia a la variación
  
  confidence = Math.min(100, confidence);
  
  // Simplified detection criteria
  const basicDetection = 
    isBrightEnough && 
    isRedDominant &&
    isRedHighest &&
    isRedIntenseEnough &&
    notTooIntense;

  // Emergency detection mode
  const emergencyDetection = isRedHighest && isRedIntenseEnough && isBrightEnough && brightness > 60;
  
  // Combined detection 
  let isFingerDetected = basicDetection || (emergencyDetection && redDominance > 0);
  
  // Update detection history
  detectionHistory.push(isFingerDetected);
  if (detectionHistory.length > HISTORY_SIZE) {
    detectionHistory.shift();
  }
  
  // Temporal consistency check
  if (isFingerDetected) {
    consecutiveDetections++;
    consecutiveNonDetections = 0;
    
    // Only consider detected after consistent readings
    if (consecutiveDetections < REQUIRED_CONSECUTIVE_DETECTIONS) {
      isFingerDetected = false;
    }
  } else {
    consecutiveNonDetections++;
    // Allow a few missed frames before considering finger removed
    if (consecutiveNonDetections < MAX_CONSECUTIVE_NON_DETECTIONS && 
        consecutiveDetections >= REQUIRED_CONSECUTIVE_DETECTIONS) {
      isFingerDetected = true;
    } else {
      consecutiveDetections = 0;
    }
  }
  
  // More conservative stable detection
  const stableDetection = 
    detectionHistory.length >= HISTORY_SIZE / 2 &&
    detectionHistory.filter(d => d).length >= Math.floor(detectionHistory.length * 0.6);

  // Apply temporal smoothing with slower adaptation
  const alpha = 0.25; // Less aggressive smoothing
  previousConfidence = alpha * confidence + (1 - alpha) * previousConfidence;
  const finalConfidence = Math.round(previousConfidence);

  // Final detection decision with temporal stability
  const finalDetection = stableDetection && isFingerDetected;
  
  // Update last detection time for future reference
  if (finalDetection) {
    lastDetectionTime = now;
  }

  // Detailed logs for every frame
  console.log(`DEDO DEBUG: R:${avgRed.toFixed(0)} G:${avgGreen.toFixed(0)} B:${avgBlue.toFixed(0)} RGratio:${redGreenRatio.toFixed(2)} RBratio:${redBlueRatio.toFixed(2)}`);
  console.log(`CRITERIOS: Bright:${brightness.toFixed(0)}/${currentBrightnessThreshold.toFixed(0)} RedDom:${redDominance.toFixed(0)}/${currentRedDominanceThreshold.toFixed(0)}`);
  console.log(`DETECCIÓN: Basic:${basicDetection} Emergency:${emergencyDetection} Final:${finalDetection} Conf:${finalConfidence}`);

  return {
    detected: finalDetection,
    confidence: finalConfidence,
    metrics: {
      brightness,
      redDominance,
      redIntensity: avgRed,
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
  
  // Simplified quality calculation - sin parámetros de skin color
  
  // Factor de dominancia de rojo (ideal: >15)
  const redDominanceFactor = Math.min(100, Math.max(0, (metrics.redDominance / 25) * 100));
  
  // Factor de brillo (ideal: 100-200 en escala 0-255)
  const idealBrightness = 150;
  const brightnessDeviation = Math.abs(metrics.brightness - idealBrightness);
  const brightnessFactor = Math.max(0, 100 - (brightnessDeviation / 1.5));
  
  // Factor de intensidad de rojo (ideal: 80-200 en escala 0-255)
  const redIntensityFactor = metrics.redIntensity < 80 ? 
    Math.min(90, (metrics.redIntensity / 80) * 90) : 
    Math.min(100, (1 - (metrics.redIntensity - 80) / 120) * 100);
  
  // Factor de contraste rojo-verde (importante para PPG signal)
  const redGreenContrastFactor = Math.min(100, Math.max(0, 
    (metrics.redIntensity - metrics.greenIntensity) * 4));
  
  // Simplified weighted formula
  const quality = (
    redDominanceFactor * 0.35 +    // Increased weight for red dominance
    brightnessFactor * 0.30 +    
    redIntensityFactor * 0.20 +  
    redGreenContrastFactor * 0.15
  );
  
  // Apply minimum threshold but with a higher minimum
  return Math.max(30, Math.round(quality));
}
