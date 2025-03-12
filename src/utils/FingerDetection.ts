
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

// Histórico para estabilización de detección - reduced size for better performance
const detectionHistory: boolean[] = [];
const HISTORY_SIZE = 5; // Reduced from 10 to improve performance
let previousConfidence = 0;

// Tracking de consistencia temporal
let lastDetectionTime = 0;
let consecutiveDetections = 0;
let consecutiveNonDetections = 0;
const REQUIRED_CONSECUTIVE_DETECTIONS = 1; // Mantener en 1 para detección inmediata
const MAX_CONSECUTIVE_NON_DETECTIONS = 6; // Reducido a 6 para mejor rendimiento

/**
 * Analiza una región de imagen para detectar la presencia de un dedo
 * Utiliza múltiples métricas para una detección más precisa
 */
export function detectFinger(
  imageData: ImageData, 
  options: DetectionOptions = {}
): FingerDetectionResult {
  const {
    redThreshold = 50,             // Reduced threshold for easier detection
    brightnessThreshold = 30,      // Lower brightness requirement
    redDominanceThreshold = 10,    // Reduced for easier detection
    regionSize = 30,               // Smaller region for faster processing
    adaptiveMode = true,           // Keep adaptive detection
    maxIntensityThreshold = 250    // Higher to avoid false negatives
  } = options;

  const now = Date.now();
  
  // Simplificar cálculos para mejorar rendimiento
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
  let skinColorPixels = 0;
  
  // Skip rows for better performance (process every 2nd row and column)
  const rowStep = 2;
  const colStep = 2;

  // Analizar solo la región central con pasos para mejorar rendimiento
  for (let y = startY; y < startY + regionHeightPx; y += rowStep) {
    for (let x = startX; x < startX + regionWidthPx; x += colStep) {
      const idx = (y * width + x) * 4;
      
      if (idx >= imageData.data.length - 4) continue; // Skip invalid indices
      
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      
      // Much more permissive skin color detection
      const isSkinColor = (
        r > g * 1.05 &&          // Very minimal red-green ratio
        r > b * 1.08 &&          // Very minimal red-blue ratio
        r > 40                   // Lower minimum red
      );

      if (isSkinColor) {
        skinColorPixels++;
      }
      
      // Acumular valores
      totalRed += r;
      totalGreen += g;
      totalBlue += b;
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
  const skinColorPercentage = (skinColorPixels / pixelCount) * 100;
  
  // Much more permissive ratios for detection
  const redGreenRatio = avgRed / (avgGreen || 1);
  const redBlueRatio = avgRed / (avgBlue || 1);
  
  // Very permissive pattern detection
  const hasHumanSkinPattern = 
    redGreenRatio > 1.05 &&      // Minimal ratio requirement
    redBlueRatio > 1.05 &&       // Minimal ratio requirement
    skinColorPercentage > 10;     // Very low percentage requirement
    
  // Umbrales adaptativos - more permissive
  let currentRedThreshold = redThreshold;
  let currentBrightnessThreshold = brightnessThreshold;
  let currentRedDominanceThreshold = redDominanceThreshold;
  
  if (adaptiveMode) {
    // More permissive adaptation
    if (brightness > 150) {
      // Bright environment: slightly adjusted thresholds
      currentRedThreshold *= 1.1;
      currentRedDominanceThreshold *= 1.1;
    } else if (brightness < 80) {
      // Low light: more permissive
      currentRedThreshold *= 0.7;
      currentBrightnessThreshold *= 0.7;
      currentRedDominanceThreshold *= 0.7;
    }
  }

  // More permissive detection criteria
  const isBrightEnough = brightness > currentBrightnessThreshold;
  const isRedDominant = redDominance > currentRedDominanceThreshold;
  const isRedHighest = avgRed > avgGreen * 1.05 && avgRed > avgBlue * 1.05; // Much more permissive
  const isRedIntenseEnough = avgRed > currentRedThreshold;
  const notTooIntense = avgRed < maxIntensityThreshold && 
                        avgGreen < maxIntensityThreshold && 
                        avgBlue < maxIntensityThreshold;
  
  // More permissive confidence calculation
  let confidence = 0;
  
  if (isBrightEnough) confidence += 20;
  if (isRedDominant) confidence += 20;
  if (isRedHighest) confidence += 20;
  if (isRedIntenseEnough) confidence += 20;
  if (notTooIntense) confidence += 10;
  if (hasHumanSkinPattern) confidence += 20;
  if (skinColorPercentage > 30) confidence += 15;
  
  confidence = Math.min(100, confidence);
  
  // More permissive detection criteria
  const basicDetection = 
    isBrightEnough && 
    (isRedDominant || isRedHighest) &&  // More permissive - only one needed
    isRedIntenseEnough;

  // Lower threshold for initial detection (40 instead of 50)
  const fingerDetected = basicDetection && confidence > 40;

  // Special backup detection mode - even more permissive for recovery
  const emergencyDetection = isRedHighest && isRedIntenseEnough && isBrightEnough;
  
  // Incorporate temporal stability logic - simplified for better performance
  let isFingerDetected = fingerDetected || emergencyDetection;
  
  // Update detection history - with fewer elements for better performance
  detectionHistory.push(isFingerDetected);
  if (detectionHistory.length > HISTORY_SIZE) {
    detectionHistory.shift();
  }
  
  // Simplified temporal consistency check
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
  
  // More permissive stable detection
  const stableDetection = 
    detectionHistory.filter(d => d).length >= Math.floor(detectionHistory.length * 0.4); // Reduced from 0.5 to 0.4

  // Apply temporal smoothing with faster adaptation for better responsiveness
  const alpha = 0.3; // Increased for faster adaptation
  previousConfidence = alpha * confidence + (1 - alpha) * previousConfidence;
  const finalConfidence = Math.round(previousConfidence);

  // Final detection decision with temporal stability
  const finalDetection = stableDetection && isFingerDetected;
  
  // Update last detection time
  if (finalDetection) {
    lastDetectionTime = now;
  }

  // Minimal logging to improve performance - only log every 10th frame or on state change
  if (frameCountRef.current % 10 === 0 || lastFinalDetectionRef.current !== finalDetection) {
    console.log(`DEDO DEBUG: R:${avgRed.toFixed(0)} G:${avgGreen.toFixed(0)} B:${avgBlue.toFixed(0)} RGratio:${redGreenRatio.toFixed(2)} RBratio:${redBlueRatio.toFixed(2)}`);
    console.log(`CRITERIOS: Bright:${brightness.toFixed(0)}/${currentBrightnessThreshold.toFixed(0)} RedDom:${redDominance.toFixed(0)}/${currentRedDominanceThreshold.toFixed(0)} Skin%:${skinColorPercentage.toFixed(0)}`);
    console.log(`DETECCIÓN: Basic:${basicDetection} Skin:${hasHumanSkinPattern} Emergency:${emergencyDetection} Final:${finalDetection} Conf:${finalConfidence}`);
    
    lastFinalDetectionRef.current = finalDetection;
    frameCountRef.current = 0;
  }
  frameCountRef.current++;

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

// Performance optimization - use refs to avoid recreating these on each call
const frameCountRef = { current: 0 };
const lastFinalDetectionRef = { current: false };

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
  
  // Simplified formula for better performance
  
  // Factor de dominancia de rojo (ideal: >10)
  const redDominanceFactor = Math.min(100, Math.max(0, (metrics.redDominance / 20) * 100));
  
  // Factor de brillo (ideal: 80-180 en escala 0-255)
  const idealBrightness = 130;
  const brightnessDeviation = Math.abs(metrics.brightness - idealBrightness);
  const brightnessFactor = Math.max(0, 100 - (brightnessDeviation / 1.5));
  
  // Factor de intensidad de rojo (ideal: 60-180 en escala 0-255)
  const redIntensityFactor = metrics.redIntensity < 60 ? 
    Math.min(90, (metrics.redIntensity / 60) * 90) : 
    Math.min(100, (1 - (metrics.redIntensity - 60) / 120) * 100);
  
  // More permissive quality formula
  const quality = (
    redDominanceFactor * 0.4 +    
    brightnessFactor * 0.3 +    
    redIntensityFactor * 0.3
  );
  
  // Apply minimum threshold - higher minimum value
  return Math.max(30, Math.round(quality));
}
