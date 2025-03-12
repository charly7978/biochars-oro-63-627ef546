
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
const HISTORY_SIZE = 15; // Increased for better stability
let previousConfidence = 0;

// Tracking de consistencia temporal
let lastDetectionTime = 0;
let consecutiveDetections = 0;
let consecutiveNonDetections = 0;
const REQUIRED_CONSECUTIVE_DETECTIONS = 3; // Increased for more reliable detection
const MAX_CONSECUTIVE_NON_DETECTIONS = 4; // Reduced to be more responsive to removal

/**
 * Analiza una región de imagen para detectar la presencia de un dedo
 * Utiliza múltiples métricas para una detección más precisa
 */
export function detectFinger(
  imageData: ImageData, 
  options: DetectionOptions = {}
): FingerDetectionResult {
  const {
    redThreshold = 80,              // Increased for less false positives
    brightnessThreshold = 50,       // Increased for less false positives
    redDominanceThreshold = 20,     // Increased for better red detection
    regionSize = 35,                // Smaller region for more accurate central analysis
    adaptiveMode = true,
    maxIntensityThreshold = 240     // Slightly increased to allow brighter signals
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
  
  // Ratios for finger detection - increased thresholds
  const redGreenRatio = avgRed / (avgGreen || 1);
  const redBlueRatio = avgRed / (avgBlue || 1);
  
  // Calculate brightness uniformity (important for detecting a finger vs background)
  brightnessValues.sort((a, b) => a - b);
  const medianBrightness = brightnessValues[Math.floor(brightnessValues.length / 2)];
  const q1 = brightnessValues[Math.floor(brightnessValues.length * 0.25)];
  const q3 = brightnessValues[Math.floor(brightnessValues.length * 0.75)];
  const brightnessUniformity = 1 - ((q3 - q1) / (medianBrightness || 1));
  
  // Umbrales adaptativos con menos permisividad
  let currentRedThreshold = redThreshold;
  let currentBrightnessThreshold = brightnessThreshold;
  let currentRedDominanceThreshold = redDominanceThreshold;
  
  if (adaptiveMode) {
    if (brightness > 180) {
      // For very bright images, require more red
      currentRedThreshold *= 1.4;
      currentRedDominanceThreshold *= 1.5;
    } else if (brightness < 80) {
      // For dark images, be slightly more permissive
      currentRedThreshold *= 0.85;
      currentBrightnessThreshold *= 0.85;
      currentRedDominanceThreshold *= 0.9;
    }
  }

  // Enhanced detection criteria with stricter thresholds
  const isBrightEnough = brightness > currentBrightnessThreshold;
  const isRedDominant = redDominance > currentRedDominanceThreshold;
  const isRedHighest = avgRed > avgGreen * 1.25 && avgRed > avgBlue * 1.3; // Stricter ratios
  const isRedIntenseEnough = avgRed > currentRedThreshold;
  const notTooIntense = avgRed < maxIntensityThreshold && 
                        avgGreen < maxIntensityThreshold && 
                        avgBlue < maxIntensityThreshold;
  
  // Red variation for pulse detection
  const redVariation = maxRed - minRed;
  const hasGoodVariation = redVariation > 8; // Higher threshold for better quality
  
  // Enhanced confidence calculation with brightness uniformity
  let confidence = 0;
  
  if (isBrightEnough) confidence += 20;
  if (isRedDominant) confidence += 25;
  if (isRedHighest) confidence += 25;
  if (isRedIntenseEnough) confidence += 20;
  if (notTooIntense) confidence += 10;
  if (hasGoodVariation) confidence += 15;
  if (brightnessUniformity > 0.7) confidence += 15; // Reward uniformity
  
  confidence = Math.min(100, confidence);
  
  // Stricter detection criteria
  const basicDetection = 
    isBrightEnough && 
    isRedDominant &&
    isRedHighest &&
    isRedIntenseEnough &&
    notTooIntense;

  // More strict emergency detection mode
  const emergencyDetection = 
    isRedHighest && 
    isRedIntenseEnough && 
    isBrightEnough && 
    brightness > 70 && 
    redDominance > 25;
  
  // Combined detection with stricter criteria
  let isFingerDetected = basicDetection || (emergencyDetection && brightnessUniformity > 0.65);
  
  // Update detection history
  detectionHistory.push(isFingerDetected);
  if (detectionHistory.length > HISTORY_SIZE) {
    detectionHistory.shift();
  }
  
  // Temporal consistency check with stricter requirements
  if (isFingerDetected) {
    consecutiveDetections++;
    consecutiveNonDetections = 0;
    
    // Only consider detected after consistent readings
    if (consecutiveDetections < REQUIRED_CONSECUTIVE_DETECTIONS) {
      isFingerDetected = false;
    }
  } else {
    consecutiveNonDetections++;
    // Allow fewer missed frames before considering finger removed
    if (consecutiveNonDetections < MAX_CONSECUTIVE_NON_DETECTIONS && 
        consecutiveDetections >= REQUIRED_CONSECUTIVE_DETECTIONS) {
      isFingerDetected = true;
    } else {
      consecutiveDetections = 0;
    }
  }
  
  // More strict stable detection
  const stableDetection = 
    detectionHistory.length >= HISTORY_SIZE / 2 &&
    detectionHistory.filter(d => d).length >= Math.floor(detectionHistory.length * 0.7); // Increased ratio

  // Apply temporal smoothing with slower adaptation for stability
  const alpha = 0.2; // Less aggressive smoothing
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
  console.log(`CRITERIOS: Bright:${brightness.toFixed(0)}/${currentBrightnessThreshold.toFixed(0)} RedDom:${redDominance.toFixed(0)}/${currentRedDominanceThreshold.toFixed(0)} Unif:${brightnessUniformity.toFixed(2)}`);
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
  
  // Improved quality calculation
  
  // Factor de dominancia de rojo (ideal: >20)
  const redDominanceFactor = Math.min(100, Math.max(0, (metrics.redDominance / 30) * 100));
  
  // Factor de brillo (ideal: 120-190 en escala 0-255)
  const idealBrightness = 150;
  const brightnessDeviation = Math.abs(metrics.brightness - idealBrightness);
  const brightnessFactor = Math.max(0, 100 - (brightnessDeviation / 1.2));
  
  // Factor de intensidad de rojo (ideal: 100-190 en escala 0-255)
  const redIntensityFactor = metrics.redIntensity < 100 ? 
    Math.min(85, (metrics.redIntensity / 100) * 85) : 
    Math.min(100, (1 - (metrics.redIntensity - 100) / 90) * 100);
  
  // Factor de contraste rojo-verde (importante para PPG signal)
  const redGreenContrastFactor = Math.min(100, Math.max(0, 
    (metrics.redIntensity - metrics.greenIntensity) * 3.5));
  
  // Balanced weighted formula
  const quality = (
    redDominanceFactor * 0.4 +     // Increased weight for red dominance
    brightnessFactor * 0.3 +    
    redIntensityFactor * 0.15 +  
    redGreenContrastFactor * 0.15
  );
  
  // Apply higher minimum threshold for better signal quality
  return Math.max(40, Math.round(quality));
}
