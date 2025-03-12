
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

// Añadir variable global para suavizado temporal de la calidad de señal
let previousConfidence = 0;
// Histórico para estabilización de detección
const detectionHistory: boolean[] = [];
const HISTORY_SIZE = 5;

/**
 * Analiza una región de imagen para detectar la presencia de un dedo
 * Utiliza múltiples métricas para una detección más precisa
 */
export function detectFinger(
  imageData: ImageData, 
  options: DetectionOptions = {}
): FingerDetectionResult {
  const {
    redThreshold = 60,             // Lowered threshold for easier detection
    brightnessThreshold = 30,      // Lower brightness threshold for easier detection
    redDominanceThreshold = 10,    // Reduced for easier acceptance
    regionSize = 50,               // Focus on central region for finger tip detection
    adaptiveMode = true,
    maxIntensityThreshold = 240    // Avoid very bright reflections
  } = options;

  // Calcular dimensiones y coordenadas de la región central (focus on fingertip area)
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
  let skinColorPixels = 0;
  let fingerShapeCount = 0;  // Counter for finger morphology pattern

  // Enhanced metrics for finger morphology detection
  let rowRedValues: number[][] = [];
  let colRedValues: number[][] = [];
  
  // Initialize arrays for morphology analysis
  for (let i = 0; i < regionHeightPx; i++) {
    rowRedValues[i] = [];
  }
  
  for (let i = 0; i < regionWidthPx; i++) {
    colRedValues[i] = [];
  }

  // Analizar solo la región central
  for (let y = startY; y < startY + regionHeightPx; y++) {
    for (let x = startX; x < startX + regionWidthPx; x++) {
      const idx = (y * width + x) * 4;
      
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      
      // Less strict skin color detection to accept fingertips better
      const isSkinColor = (
        r > g * 1.05 &&          // Reduced red-green ratio for fingertips
        r > b * 1.15 &&          // Reduced red-blue ratio for fingertips
        r > 45 &&                // Lower red threshold
        g > 20 &&                // Lower green threshold
        b > 10 &&                // Minimum blue for skin tone
        r < 240 &&               // Avoid pure white/reflections
        Math.abs(g - b) < 30     // Green and blue tend to be close in skin tones
      );

      if (isSkinColor) {
        skinColorPixels++;
      }
      
      // Store values for morphology analysis
      const relY = y - startY;
      const relX = x - startX;
      if (relY >= 0 && relY < regionHeightPx) {
        rowRedValues[relY].push(r);
      }
      if (relX >= 0 && relX < regionWidthPx) {
        colRedValues[relX].push(r);
      }
      
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

  // Analyze finger morphology
  // 1. Check if there's a gradient pattern characteristic of a curved fingertip
  let hasFingerGradient = false;
  let fingerGradientStrength = 0;
  
  // Process rows to detect curved fingertip pattern - more permissive for fingertips
  for (let i = 0; i < rowRedValues.length; i++) {
    const row = rowRedValues[i];
    if (row.length > 4) {
      // Check if the row has higher values in the center (curved finger pattern)
      const leftEdge = row.slice(0, Math.floor(row.length * 0.25));
      const center = row.slice(Math.floor(row.length * 0.25), Math.floor(row.length * 0.75));
      const rightEdge = row.slice(Math.floor(row.length * 0.75));
      
      const leftAvg = leftEdge.reduce((sum, val) => sum + val, 0) / leftEdge.length;
      const centerAvg = center.reduce((sum, val) => sum + val, 0) / center.length;
      const rightAvg = rightEdge.reduce((sum, val) => sum + val, 0) / rightEdge.length;
      
      // More permissive for fingertip - small gradient difference is enough
      if (centerAvg > leftAvg * 0.95 && centerAvg > rightAvg * 0.95) {
        fingerGradientStrength += (centerAvg - ((leftAvg + rightAvg) / 2));
        hasFingerGradient = true;
        fingerShapeCount++;
      }
    }
  }
  
  // Normalize the gradient strength
  fingerGradientStrength = fingerGradientStrength / (rowRedValues.length || 1);

  const avgRed = totalRed / pixelCount;
  const avgGreen = totalGreen / pixelCount;
  const avgBlue = totalBlue / pixelCount;
  const brightness = (avgRed + avgGreen + avgBlue) / 3;
  const redDominance = avgRed - ((avgGreen + avgBlue) / 2);
  const skinColorPercentage = (skinColorPixels / pixelCount) * 100;
  const fingerShapePercentage = (fingerShapeCount / rowRedValues.length) * 100;
  
  // Ratios for finger detection - less strict for fingertips
  const redGreenRatio = avgRed / (avgGreen || 1);
  const redBlueRatio = avgRed / (avgBlue || 1);
  
  // Specific patterns for human finger - more permissive
  const hasHumanSkinPattern = 
    redGreenRatio > 1.05 &&       // Less strict ratio for fingertips
    redBlueRatio > 1.15 &&        // Less strict ratio for fingertips
    skinColorPercentage > 30;      // Lower percentage requirement
    
  // Finger morphology pattern - more permissive
  const hasFingerMorphology = 
    hasFingerGradient && 
    fingerGradientStrength > 5 &&  // Lower threshold for fingertips
    fingerShapePercentage > 20;    // Lower percentage for fingertips
  
  // Umbrales adaptativos - more permissive
  let currentRedThreshold = redThreshold;
  let currentBrightnessThreshold = brightnessThreshold;
  let currentRedDominanceThreshold = redDominanceThreshold;
  
  if (adaptiveMode) {
    // More permissive adaptation
    if (brightness > 180) {
      // Bright environment: adjusted thresholds
      currentRedThreshold *= 1.2;
      currentRedDominanceThreshold *= 1.3;
    } else if (brightness < 80) {
      // Low light: more permissive thresholds
      currentRedThreshold *= 0.7;
      currentBrightnessThreshold *= 0.7;
      currentRedDominanceThreshold *= 0.7;
    }
    
    // More permissive with skin percentage
    if (skinColorPercentage > 60) {
      currentRedDominanceThreshold *= 0.8;
    }
  }

  // Less strict detection criteria for fingertips
  const isBrightEnough = brightness > currentBrightnessThreshold;
  const isRedDominant = redDominance > currentRedDominanceThreshold;
  const isRedHighest = avgRed > avgGreen * 1.05 && avgRed > avgBlue * 1.15; // Less strict
  const isRedIntenseEnough = avgRed > currentRedThreshold;
  const notTooIntense = avgRed < maxIntensityThreshold && 
                        avgGreen < maxIntensityThreshold && 
                        avgBlue < maxIntensityThreshold;
  
  // Evaluación de variación temporal
  const redVariation = maxRed - minRed;
  const hasGoodVariation = redVariation > 3; // Lower threshold for variation
  
  // More generous confidence calculation for fingertips
  let confidence = 0;
  
  if (isBrightEnough) confidence += 15;
  if (isRedDominant) confidence += 15;
  if (isRedHighest) confidence += 15;
  if (isRedIntenseEnough) confidence += 15;
  if (notTooIntense) confidence += 10;
  if (hasGoodVariation) confidence += 10;
  if (hasHumanSkinPattern) confidence += 20;
  if (skinColorPercentage > 30) confidence += 15; // Lower threshold
  if (hasFingerMorphology) confidence += 25;
  if (fingerGradientStrength > 8) confidence += 10;
  
  confidence = Math.min(100, confidence);
  
  // Basic detection criteria - more permissive
  const basicDetection = 
    isBrightEnough && 
    isRedDominant &&
    isRedHighest &&
    isRedIntenseEnough &&
    notTooIntense;

  // Lower confidence requirement for fingertip detection
  const fingerDetected = basicDetection && hasHumanSkinPattern && confidence > 40; // Lower threshold

  // Specialized detection modes - more permissive for fingertips
  const colorBasedDetection = isRedHighest && isRedIntenseEnough && isBrightEnough;
  const morphologyBasedDetection = hasFingerMorphology && hasHumanSkinPattern && notTooIntense;
  
  // More permissive combined detection
  const multiMethodDetection = colorBasedDetection && (fingerGradientStrength > 5 || hasFingerMorphology);

  // Incorporate stabilization with history
  detectionHistory.push(fingerDetected || multiMethodDetection || morphologyBasedDetection);
  if (detectionHistory.length > HISTORY_SIZE) {
    detectionHistory.shift();
  }
  
  // More permissive stable detection
  const stableDetection = 
    detectionHistory.length >= 3 &&
    detectionHistory.filter(d => d).length >= Math.floor(detectionHistory.length * 0.4); // Lower threshold

  // Apply temporal smoothing with slower adaptation to reduce false positives
  const alpha = 0.3;
  previousConfidence = alpha * confidence + (1 - alpha) * previousConfidence;
  const finalConfidence = Math.round(previousConfidence);

  // Better logging with important info
  console.log(`Finger metrics: R:${avgRed.toFixed(0)} G:${avgGreen.toFixed(0)} B:${avgBlue.toFixed(0)} Bright:${brightness.toFixed(0)} RedDom:${redDominance.toFixed(0)} Skin%:${skinColorPercentage.toFixed(0)} FShape%:${fingerShapePercentage.toFixed(0)} GradStr:${fingerGradientStrength.toFixed(1)} Conf:${finalConfidence} Detected:${stableDetection || fingerDetected || multiMethodDetection}`);

  return {
    detected: stableDetection || fingerDetected || multiMethodDetection || morphologyBasedDetection,
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
  
  // Modified formula for signal quality with emphasis on fingertip detection
  
  // Factor de dominancia de rojo (ideal: >15) - reduced requirement
  const redDominanceFactor = Math.min(100, Math.max(0, (metrics.redDominance / 25) * 100));
  
  // Factor de brillo (ideal: 100-200 en escala 0-255) - wider optimal range
  const idealBrightness = 150;
  const brightnessDeviation = Math.abs(metrics.brightness - idealBrightness);
  const brightnessFactor = Math.max(0, 100 - (brightnessDeviation / 2.0)); // More permissive
  
  // Factor de intensidad de rojo (ideal: 70-200 en escala 0-255) - wider optimal range
  const redIntensityFactor = metrics.redIntensity < 70 ? 
    Math.min(100, (metrics.redIntensity / 70) * 90) : 
    Math.min(100, (1 - (metrics.redIntensity - 70) / 130) * 100);
  
  // Factor de contraste rojo-verde (importante para PPG signal)
  const redGreenContrastFactor = Math.min(100, Math.max(0, 
    (metrics.redIntensity - metrics.greenIntensity) * 5)); // Less strict
  
  // More permissive ranges for fingertips
  const greenOptimalFactor = Math.max(0, 100 - Math.abs(metrics.greenIntensity - 70) / 2.0);
  const blueOptimalFactor = Math.max(0, 100 - Math.abs(metrics.blueIntensity - 60) / 2.0);
  
  // Ponderación de factores optimizada para dedo - increased weights for core factors
  const quality = (
    redDominanceFactor * 0.25 +    
    brightnessFactor * 0.25 +     // Increased weight
    redIntensityFactor * 0.20 +   
    redGreenContrastFactor * 0.15 +
    greenOptimalFactor * 0.08 +   // Decreased weight
    blueOptimalFactor * 0.07      // Decreased weight
  );
  
  // More permissive minimum quality
  return Math.max(15, Math.round(quality));
}
