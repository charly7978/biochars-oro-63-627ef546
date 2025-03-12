
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
// CAMBIO 1: Reducir el número requerido de detecciones consecutivas para considerar un dedo
const REQUIRED_CONSECUTIVE_DETECTIONS = 2; // Reducido de 3 a 2
// CAMBIO 2: Aumentar el máximo de no-detecciones consecutivas antes de considerar que se quitó el dedo
const MAX_CONSECUTIVE_NON_DETECTIONS = 6; // Aumentado de 4 a 6

/**
 * Analiza una región de imagen para detectar la presencia de un dedo
 * Utiliza múltiples métricas para una detección más precisa
 */
export function detectFinger(
  imageData: ImageData, 
  options: DetectionOptions = {}
): FingerDetectionResult {
  const {
    redThreshold = 65,             // Increased to reduce false positives
    brightnessThreshold = 35,      // Slightly increased for better lighting requirement
    redDominanceThreshold = 15,    // Increased for stricter red dominance
    regionSize = 40,               // Focused region size for fingertip
    adaptiveMode = true,
    maxIntensityThreshold = 235    // Avoid very bright reflections
  } = options;

  const now = Date.now();
  
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
      
      // More strict skin color detection to reduce false positives
      const isSkinColor = (
        r > g * 1.15 &&          // Increased red-green ratio
        r > b * 1.25 &&          // Increased red-blue ratio
        r > 55 &&                // Higher red threshold
        g > 30 &&                // Higher green threshold
        b > 15 &&                // Higher minimum blue for skin tone
        r < 230 &&               // Avoid pure white/reflections
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
    console.log("FingerDetection: No hay píxeles para analizar");
    consecutiveNonDetections++;
    consecutiveDetections = 0;
    return getEmptyResult();
  }

  // Analyze finger morphology - more strict requirements
  let hasFingerGradient = false;
  let fingerGradientStrength = 0;
  
  // Process rows to detect curved fingertip pattern
  for (let i = 0; i < rowRedValues.length; i++) {
    const row = rowRedValues[i];
    if (row.length > 5) {
      // Analyze if the row has higher values in the center (curved finger pattern)
      const leftEdge = row.slice(0, Math.floor(row.length * 0.25));
      const center = row.slice(Math.floor(row.length * 0.25), Math.floor(row.length * 0.75));
      const rightEdge = row.slice(Math.floor(row.length * 0.75));
      
      const leftAvg = leftEdge.reduce((sum, val) => sum + val, 0) / leftEdge.length;
      const centerAvg = center.reduce((sum, val) => sum + val, 0) / center.length;
      const rightAvg = rightEdge.reduce((sum, val) => sum + val, 0) / rightEdge.length;
      
      // More balanced gradient requirement for fingertip
      if (centerAvg > leftAvg * 1.05 && centerAvg > rightAvg * 1.05) {
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
  
  // Ratios for finger detection - more balanced for reliable detection
  const redGreenRatio = avgRed / (avgGreen || 1);
  const redBlueRatio = avgRed / (avgBlue || 1);
  
  // Stricter patterns for human finger
  const hasHumanSkinPattern = 
    redGreenRatio > 1.12 &&      // Higher ratio requirement
    redBlueRatio > 1.20 &&       // Higher ratio requirement
    skinColorPercentage > 40;     // Higher percentage requirement
    
  // Finger morphology pattern - more balanced
  const hasFingerMorphology = 
    hasFingerGradient && 
    fingerGradientStrength > 8 &&  // Higher strength requirement
    fingerShapePercentage > 30;    // Higher percentage requirement
  
  // Umbrales adaptativos - less permissive
  let currentRedThreshold = redThreshold;
  let currentBrightnessThreshold = brightnessThreshold;
  let currentRedDominanceThreshold = redDominanceThreshold;
  
  if (adaptiveMode) {
    // Less permissive adaptation
    if (brightness > 180) {
      // Bright environment: adjusted thresholds
      currentRedThreshold *= 1.3;  // Higher red requirement
      currentRedDominanceThreshold *= 1.4; // Higher dominance requirement
    } else if (brightness < 80) {
      // Low light: slightly more permissive but still strict
      currentRedThreshold *= 0.8;
      currentBrightnessThreshold *= 0.8;
      currentRedDominanceThreshold *= 0.8;
    }
    
    // More conservative with skin percentage
    if (skinColorPercentage > 60) {
      currentRedDominanceThreshold *= 0.9; // Less reduction than before
    }
  }

  // Stricter detection criteria
  const isBrightEnough = brightness > currentBrightnessThreshold;
  const isRedDominant = redDominance > currentRedDominanceThreshold;
  const isRedHighest = avgRed > avgGreen * 1.12 && avgRed > avgBlue * 1.20; // Stricter ratios
  const isRedIntenseEnough = avgRed > currentRedThreshold;
  const notTooIntense = avgRed < maxIntensityThreshold && 
                        avgGreen < maxIntensityThreshold && 
                        avgBlue < maxIntensityThreshold;
  
  // Evaluación de variación temporal
  const redVariation = maxRed - minRed;
  const hasGoodVariation = redVariation > 5; // Higher threshold for variation
  
  // More balanced confidence calculation
  let confidence = 0;
  
  if (isBrightEnough) confidence += 15;
  if (isRedDominant) confidence += 20; // Higher weight for red dominance
  if (isRedHighest) confidence += 20;
  if (isRedIntenseEnough) confidence += 15;
  if (notTooIntense) confidence += 10;
  if (hasGoodVariation) confidence += 8;
  if (hasHumanSkinPattern) confidence += 25; // Higher weight for skin pattern
  if (skinColorPercentage > 40) confidence += 15;
  if (hasFingerMorphology) confidence += 25;
  if (fingerGradientStrength > 10) confidence += 15;
  
  confidence = Math.min(100, confidence);
  
  // More strict detection criteria
  const basicDetection = 
    isBrightEnough && 
    isRedDominant &&
    isRedHighest &&
    isRedIntenseEnough &&
    notTooIntense;

  // Higher confidence requirement
  const fingerDetected = basicDetection && hasHumanSkinPattern && confidence > 60;

  // Specialized detection modes 
  const colorBasedDetection = isRedHighest && isRedIntenseEnough && isBrightEnough && isRedDominant;
  const morphologyBasedDetection = hasFingerMorphology && hasHumanSkinPattern && notTooIntense;
  
  // Combined detection with higher requirements
  const multiMethodDetection = colorBasedDetection && (fingerGradientStrength > 8 || hasFingerMorphology);

  // Incorporate temporal stability logic
  let isFingerDetected = fingerDetected || multiMethodDetection || morphologyBasedDetection;
  
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
  console.log(`CRITERIOS: Bright:${brightness.toFixed(0)}/${currentBrightnessThreshold.toFixed(0)} RedDom:${redDominance.toFixed(0)}/${currentRedDominanceThreshold.toFixed(0)} Skin%:${skinColorPercentage.toFixed(0)} Shape%:${fingerShapePercentage.toFixed(0)}`);
  console.log(`DETECCIÓN: Basic:${basicDetection} Skin:${hasHumanSkinPattern} Morpho:${hasFingerMorphology} Color:${colorBasedDetection} MultiMethod:${multiMethodDetection}`);
  console.log(`TEMPORAL: ConsecDet:${consecutiveDetections}/${REQUIRED_CONSECUTIVE_DETECTIONS} ConsecNonDet:${consecutiveNonDetections}/${MAX_CONSECUTIVE_NON_DETECTIONS} Stable:${stableDetection} Final:${finalDetection} Conf:${finalConfidence}`);

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
  
  // Modified formula for signal quality with stricter requirements
  
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
  
  // More strict optimal ranges
  const greenOptimalFactor = Math.max(0, 100 - Math.abs(metrics.greenIntensity - 70) / 1.5);
  const blueOptimalFactor = Math.max(0, 100 - Math.abs(metrics.blueIntensity - 60) / 1.5);
  
  // Weighted formula with higher emphasis on key metrics
  const quality = (
    redDominanceFactor * 0.30 +    // Increased weight
    brightnessFactor * 0.25 +    
    redIntensityFactor * 0.20 +  
    redGreenContrastFactor * 0.15 +
    greenOptimalFactor * 0.05 +    // Decreased weight
    blueOptimalFactor * 0.05       // Decreased weight
  );
  
  // Apply minimum threshold
  return Math.max(20, Math.round(quality));
}
