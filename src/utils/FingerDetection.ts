
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
const HISTORY_SIZE = 10; // Reduced for faster response
let previousConfidence = 0;

// Tracking de consistencia temporal
let lastDetectionTime = 0;
let consecutiveDetections = 0;
let consecutiveNonDetections = 0;
const REQUIRED_CONSECUTIVE_DETECTIONS = 2; // Reduced for faster detection
const MAX_CONSECUTIVE_NON_DETECTIONS = 3; // Also reduced for faster response to removal

/**
 * Analiza una región de imagen para detectar la presencia de un dedo
 * Utiliza múltiples métricas para una detección más precisa
 */
export function detectFinger(
  imageData: ImageData, 
  options: DetectionOptions = {}
): FingerDetectionResult {
  const {
    redThreshold = 100,             // Increased significantly to reduce false positives
    brightnessThreshold = 60,       // Increased for less false positives
    redDominanceThreshold = 30,     // Increased significantly for better red detection
    regionSize = 30,                // Smaller region for more focused analysis
    adaptiveMode = true,
    maxIntensityThreshold = 240     // Unchanged
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
    consecutiveNonDetections++;
    consecutiveDetections = 0;
    return getEmptyResult();
  }

  const avgRed = totalRed / pixelCount;
  const avgGreen = totalGreen / pixelCount;
  const avgBlue = totalBlue / pixelCount;
  const brightness = (avgRed + avgGreen + avgBlue) / 3;
  const redDominance = avgRed - ((avgGreen + avgBlue) / 2);
  
  // Ratios for finger detection - more stringent thresholds
  const redGreenRatio = avgRed / (avgGreen || 1);
  const redBlueRatio = avgRed / (avgBlue || 1);
  
  // Calculate brightness uniformity (important for detecting a finger vs background)
  brightnessValues.sort((a, b) => a - b);
  const medianBrightness = brightnessValues[Math.floor(brightnessValues.length / 2)];
  const q1 = brightnessValues[Math.floor(brightnessValues.length * 0.25)];
  const q3 = brightnessValues[Math.floor(brightnessValues.length * 0.75)];
  const brightnessUniformity = 1 - ((q3 - q1) / (medianBrightness || 1));
  
  // Umbrales adaptativos menos permisivos
  let currentRedThreshold = redThreshold;
  let currentBrightnessThreshold = brightnessThreshold;
  let currentRedDominanceThreshold = redDominanceThreshold;
  
  if (adaptiveMode) {
    if (brightness > 200) {
      // For very bright images, require significantly more red
      currentRedThreshold *= 1.5;
      currentRedDominanceThreshold *= 1.6;
    } else if (brightness < 70) {
      // For dark images, be slightly more permissive
      currentRedThreshold *= 0.9;
      currentBrightnessThreshold *= 0.9;
      currentRedDominanceThreshold *= 0.95;
    }
  }

  // Enhanced detection criteria with stricter thresholds
  const isBrightEnough = brightness > currentBrightnessThreshold;
  const isRedDominant = redDominance > currentRedDominanceThreshold;
  const isRedHighest = avgRed > avgGreen * 1.35 && avgRed > avgBlue * 1.4; // Much stricter ratios
  const isRedIntenseEnough = avgRed > currentRedThreshold;
  const notTooIntense = avgRed < maxIntensityThreshold && 
                        avgGreen < maxIntensityThreshold && 
                        avgBlue < maxIntensityThreshold;
  
  // Uniform brightness check to reduce false positives
  const isUniform = brightnessUniformity > 0.7;
  
  // Enhanced confidence calculation with brightness uniformity
  let confidence = 0;
  
  if (isBrightEnough) confidence += 20;
  if (isRedDominant) confidence += 25;
  if (isRedHighest) confidence += 25;
  if (isRedIntenseEnough) confidence += 20;
  if (notTooIntense) confidence += 10;
  if (isUniform) confidence += 15; // Uniformity is important
  
  confidence = Math.min(100, confidence);
  
  // Stricter detection criteria
  const basicDetection = 
    isBrightEnough && 
    isRedDominant &&
    isRedHighest &&
    isRedIntenseEnough &&
    notTooIntense &&
    isUniform; // Added uniformity requirement

  // Faster emergency detection for true positives
  const emergencyDetection = 
    avgRed > 120 && // Higher minimum red
    isRedHighest && 
    redDominance > 40 && // Higher red dominance
    brightness > 80 && 
    brightnessUniformity > 0.75;
  
  // Combined detection with stricter criteria
  let isFingerDetected = basicDetection || emergencyDetection;
  
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
    // Allow fewer missed frames before considering finger removed
    if (consecutiveNonDetections < MAX_CONSECUTIVE_NON_DETECTIONS && 
        consecutiveDetections >= REQUIRED_CONSECUTIVE_DETECTIONS) {
      isFingerDetected = true;
    } else {
      consecutiveDetections = 0;
    }
  }
  
  // More permissive stable detection for speed
  const stableDetection = 
    detectionHistory.length >= HISTORY_SIZE / 2 &&
    detectionHistory.filter(d => d).length >= Math.floor(detectionHistory.length * 0.65);

  // Apply temporal smoothing for stability
  const alpha = 0.25; // More responsive smoothing
  previousConfidence = alpha * confidence + (1 - alpha) * previousConfidence;
  const finalConfidence = Math.round(previousConfidence);

  // Final detection decision with temporal stability
  const finalDetection = (stableDetection && isFingerDetected) || 
                         (emergencyDetection && consecutiveDetections >= 1); // Fast path for strong detection
  
  // Update last detection time for future reference
  if (finalDetection) {
    lastDetectionTime = now;
  }

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
  
  // Factor de dominancia de rojo (ideal: >30)
  const redDominanceFactor = Math.min(100, Math.max(0, (metrics.redDominance / 40) * 100));
  
  // Factor de brillo (ideal: 120-190 en escala 0-255)
  const idealBrightness = 150;
  const brightnessDeviation = Math.abs(metrics.brightness - idealBrightness);
  const brightnessFactor = Math.max(0, 100 - (brightnessDeviation / 1.0));
  
  // Factor de intensidad de rojo (ideal: 120-190 en escala 0-255)
  const redIntensityFactor = metrics.redIntensity < 120 ? 
    Math.min(85, (metrics.redIntensity / 120) * 85) : 
    Math.min(100, (1 - (metrics.redIntensity - 120) / 70) * 100);
  
  // Factor de contraste rojo-verde (importante para PPG signal)
  const redGreenContrastFactor = Math.min(100, Math.max(0, 
    (metrics.redIntensity - metrics.greenIntensity) * 4.0));
  
  // Balanced weighted formula
  const quality = (
    redDominanceFactor * 0.4 +     // Emphasis on red dominance
    brightnessFactor * 0.3 +    
    redIntensityFactor * 0.15 +  
    redGreenContrastFactor * 0.15
  );
  
  // Apply higher minimum threshold for better signal quality
  return Math.max(45, Math.round(quality));
}
