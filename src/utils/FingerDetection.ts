
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
    redThreshold = 70,             // Higher threshold for stricter finger detection
    brightnessThreshold = 40,      // Keep moderate brightness threshold
    redDominanceThreshold = 15,    // Increased for stricter red dominance check
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
  let fingerShapeCount = 0;  // New counter for finger morphology pattern

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
      
      // More strict skin color detection based on human skin tone values
      const isSkinColor = (
        r > g * 1.15 &&          // Stronger red-green ratio for human skin
        r > b * 1.25 &&          // Stronger red-blue ratio for human skin
        r > 50 &&                // Minimum red threshold
        g > 25 &&                // Reasonable green for skin tone
        b > 10 &&                // Minimum blue for skin tone
        r < 240 &&               // Avoid pure white/reflections
        Math.abs(g - b) < 25     // Green and blue tend to be close in skin tones
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
  
  // Process rows to detect curved fingertip pattern
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
      
      // Finger morphology will have center brighter than edges
      if (centerAvg > leftAvg && centerAvg > rightAvg) {
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
  
  // Ratios for finger detection
  const redGreenRatio = avgRed / (avgGreen || 1);
  const redBlueRatio = avgRed / (avgBlue || 1);
  
  // Specific patterns for human finger
  const hasHumanSkinPattern = 
    redGreenRatio > 1.15 &&
    redBlueRatio > 1.25 &&
    skinColorPercentage > 40;      // Require higher percentage of skin color
    
  // Finger morphology pattern
  const hasFingerMorphology = 
    hasFingerGradient && 
    fingerGradientStrength > 10 && 
    fingerShapePercentage > 30;
  
  // Umbrales adaptativos
  let currentRedThreshold = redThreshold;
  let currentBrightnessThreshold = brightnessThreshold;
  let currentRedDominanceThreshold = redDominanceThreshold;
  
  if (adaptiveMode) {
    // More conservative adaptation
    if (brightness > 180) {
      // Ambiente muy brillante: be more strict
      currentRedThreshold *= 1.3;
      currentRedDominanceThreshold *= 1.5;
    } else if (brightness < 80) {
      // Ambiente con poca luz: adjust carefully
      currentRedThreshold *= 0.8;
      currentBrightnessThreshold *= 0.8;
      currentRedDominanceThreshold *= 0.8;
    }
    
    // Don't be too permissive with skin percentage
    if (skinColorPercentage > 70) {
      currentRedDominanceThreshold *= 0.9;
    }
  }

  // Criterios de detección más estrictos
  const isBrightEnough = brightness > currentBrightnessThreshold;
  const isRedDominant = redDominance > currentRedDominanceThreshold;
  const isRedHighest = avgRed > avgGreen * 1.15 && avgRed > avgBlue * 1.25; 
  const isRedIntenseEnough = avgRed > currentRedThreshold;
  const notTooIntense = avgRed < maxIntensityThreshold && 
                        avgGreen < maxIntensityThreshold && 
                        avgBlue < maxIntensityThreshold;
  
  // Evaluación de variación temporal
  const redVariation = maxRed - minRed;
  const hasGoodVariation = redVariation > 5; // Require reasonable variation
  
  // Cálculo de confianza más estricta y centrada en morfología de dedo
  let confidence = 0;
  
  if (isBrightEnough) confidence += 15;
  if (isRedDominant) confidence += 15;
  if (isRedHighest) confidence += 15;
  if (isRedIntenseEnough) confidence += 15;
  if (notTooIntense) confidence += 10;
  if (hasGoodVariation) confidence += 10;
  if (hasHumanSkinPattern) confidence += 20;
  if (skinColorPercentage > 40) confidence += 15;
  if (hasFingerMorphology) confidence += 25;   // Significant boost for finger shape
  if (fingerGradientStrength > 15) confidence += 10;
  
  confidence = Math.min(100, confidence);
  
  // More strict criteria requiring finger morphology
  const basicDetection = 
    isBrightEnough && 
    isRedDominant &&
    isRedHighest &&
    isRedIntenseEnough &&
    notTooIntense;

  // Higher confidence requirement
  const fingerDetected = basicDetection && hasHumanSkinPattern && confidence > 50;

  // Specialized detection modes
  const colorBasedDetection = isRedHighest && isRedIntenseEnough && isBrightEnough && isRedDominant;
  const morphologyBasedDetection = hasFingerMorphology && hasHumanSkinPattern && notTooIntense;
  
  // Require both color and some morphology evidence
  const multiMethodDetection = colorBasedDetection && (hasFingerMorphology || fingerGradientStrength > 10);

  // Incorporate stabilization with history
  detectionHistory.push(fingerDetected || multiMethodDetection || morphologyBasedDetection);
  if (detectionHistory.length > HISTORY_SIZE) {
    detectionHistory.shift();
  }
  
  // La detección final es estable pero más estricta
  const stableDetection = 
    detectionHistory.length >= 3 &&
    detectionHistory.filter(d => d).length > (detectionHistory.length / 2); // Require majority
  
  // Apply temporal smoothing with slower adaptation to reduce false positives
  const alpha = 0.3;
  previousConfidence = alpha * confidence + (1 - alpha) * previousConfidence;
  const finalConfidence = Math.round(previousConfidence);

  // Better logging with important info
  console.log(`Finger metrics: R:${avgRed.toFixed(0)} G:${avgGreen.toFixed(0)} B:${avgBlue.toFixed(0)} Bright:${brightness.toFixed(0)} RedDom:${redDominance.toFixed(0)} Skin%:${skinColorPercentage.toFixed(0)} FShape%:${fingerShapePercentage.toFixed(0)} GradStr:${fingerGradientStrength.toFixed(1)} Conf:${finalConfidence} Detected:${fingerDetected || multiMethodDetection || stableDetection}`);

  return {
    detected: stableDetection || (fingerDetected && hasFingerMorphology) || (multiMethodDetection && morphologyBasedDetection),
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
  
  // Factor de dominancia de rojo (ideal: >20)
  const redDominanceFactor = Math.min(100, Math.max(0, (metrics.redDominance / 30) * 100));
  
  // Factor de brillo (ideal: 100-200 en escala 0-255) - narrower optimal range
  const idealBrightness = 150;
  const brightnessDeviation = Math.abs(metrics.brightness - idealBrightness);
  const brightnessFactor = Math.max(0, 100 - (brightnessDeviation / 1.5));
  
  // Factor de intensidad de rojo (ideal: 80-200 en escala 0-255) - narrower optimal range
  const redIntensityFactor = metrics.redIntensity < 80 ? 
    Math.min(100, (metrics.redIntensity / 80) * 80) : 
    Math.min(100, (1 - (metrics.redIntensity - 80) / 120) * 100);
  
  // Factor de contraste rojo-verde (importante para PPG signal)
  const redGreenContrastFactor = Math.min(100, Math.max(0, 
    (metrics.redIntensity - metrics.greenIntensity) * 6));
  
  // Specific to finger detection - penalize for values outside optimal ranges
  const greenOptimalFactor = Math.max(0, 100 - Math.abs(metrics.greenIntensity - 70) / 1.5);
  const blueOptimalFactor = Math.max(0, 100 - Math.abs(metrics.blueIntensity - 60) / 1.5);
  
  // Ponderación de factores optimizada para dedo
  const quality = (
    redDominanceFactor * 0.25 +    
    brightnessFactor * 0.20 +     
    redIntensityFactor * 0.20 +   
    redGreenContrastFactor * 0.15 +
    greenOptimalFactor * 0.10 +
    blueOptimalFactor * 0.10
  );
  
  // More strict minimum quality for finger detection
  return Math.max(20, Math.round(quality));
}
