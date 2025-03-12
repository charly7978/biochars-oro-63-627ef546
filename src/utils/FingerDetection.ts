
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
  redDominanceThreshold?: number; // Diferencia mínima entre rojo y otros canales
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
    redThreshold = 40,             // Reduced from 60 to 40 for even better detection of finger pad
    brightnessThreshold = 25,      // Reduced from 30 to 25 for better sensitivity
    redDominanceThreshold = 10,    // Reduced from 15 to 10 to capture more subtle red dominance in finger pad
    regionSize = 70,               // Increased from 60 to 70 to analyze more of the image
    adaptiveMode = true,
    maxIntensityThreshold = 245    // Keep this to avoid reflections
  } = options;

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
  let skinColorPixels = 0;      // Contador para píxeles que cumplen criterios de piel

  // Analyze the entire region, not just the center
  for (let y = startY; y < startY + regionHeightPx; y++) {
    for (let x = startX; x < startX + regionWidthPx; x++) {
      const idx = (y * width + x) * 4;
      
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      
      // Make skin color detection even more permissive for finger pad
      const isSkinColor = (
        r > g * 1.0 &&           // Reduced from 1.05 to 1.0
        r > b * 1.05 &&          // Reduced from 1.1 to 1.05
        r > 40 &&                // Reduced from 50 to 40
        g > 20 &&                // Reduced from 25 to 20
        b > 8                    // Reduced from 10 to 8
      );

      if (isSkinColor) {
        skinColorPixels++;
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

  const avgRed = totalRed / pixelCount;
  const avgGreen = totalGreen / pixelCount;
  const avgBlue = totalBlue / pixelCount;
  const brightness = (avgRed + avgGreen + avgBlue) / 3;
  const redDominance = avgRed - ((avgGreen + avgBlue) / 2);
  const skinColorPercentage = (skinColorPixels / pixelCount) * 100;
  
  // Ratios de color específicos para piel humana - más permisivos para la yema del dedo
  const redGreenRatio = avgRed / (avgGreen || 1);
  const redBlueRatio = avgRed / (avgBlue || 1);
  
  // Rangos mucho más permisivos para la yema del dedo
  const hasHumanSkinPattern = 
    redGreenRatio > 1.0 &&          // Reduced from 1.1 to 1.0
    redBlueRatio > 1.1 &&           // Reduced from 1.2 to 1.1
    skinColorPercentage > 30;       // Reduced from 40 to 30
    
  // Umbrales adaptativos
  let currentRedThreshold = redThreshold;
  let currentBrightnessThreshold = brightnessThreshold;
  let currentRedDominanceThreshold = redDominanceThreshold;
  
  if (adaptiveMode) {
    // Adaptar a condiciones de luz
    if (brightness > 180) {
      // Ambiente muy brillante: ser más exigente
      currentRedThreshold *= 1.3;
      currentRedDominanceThreshold *= 1.2; // Reduced from 1.4 to 1.2
    } else if (brightness < 80) {
      // Ambiente con poca luz: ser más permisivo
      currentRedThreshold *= 0.6;    // Increased permissiveness from 0.7 to 0.6
      currentBrightnessThreshold *= 0.6; // Increased permissiveness from 0.7 to 0.6
      currentRedDominanceThreshold *= 0.6; // Increased permissiveness from 0.8 to 0.6
    }
    
    // Si detectamos muchos píxeles de piel, podemos ser menos exigentes
    if (skinColorPercentage > 50) { // Reduced from 70 to 50
      currentRedDominanceThreshold *= 0.7; // Increased permissiveness from 0.8 to 0.7
    }
    
    // Si la imagen es muy oscura, reducir aún más los umbrales
    if (brightness < 50) {
      currentBrightnessThreshold = Math.max(15, currentBrightnessThreshold * 0.5); // Increased permissiveness
      currentRedThreshold = Math.max(25, currentRedThreshold * 0.5); // Increased permissiveness
    }
  }

  // Criterios de detección mucho más permisivos para la yema del dedo
  const isBrightEnough = brightness > currentBrightnessThreshold;
  const isRedDominant = redDominance > currentRedDominanceThreshold;
  const isRedHighest = avgRed > avgGreen * 1.05 && avgRed > avgBlue * 1.08; // More permissive
  const isRedIntenseEnough = avgRed > currentRedThreshold;
  const notTooIntense = avgRed < maxIntensityThreshold && 
                        avgGreen < maxIntensityThreshold && 
                        avgBlue < maxIntensityThreshold;
  
  // Evaluación de variación temporal - más permisiva para yema del dedo
  const redVariation = maxRed - minRed;
  const hasGoodVariation = redVariation > 3; // Reduced from 5 to 3
  
  // Cálculo de confianza ajustado (mucho más permisivo)
  let confidence = 0;
  
  if (isBrightEnough) confidence += 25;         // Increased from 20
  if (isRedDominant) confidence += 25;          // Same
  if (isRedHighest) confidence += 25;           // Increased from 20
  if (isRedIntenseEnough) confidence += 20;     // Increased from 15
  if (notTooIntense) confidence += 15;          // Increased from 10
  if (hasGoodVariation) confidence += 15;       // Same
  if (hasHumanSkinPattern) confidence += 30;    // Increased from 25
  if (skinColorPercentage > 25) confidence += 25; // Reduced threshold and increased points

  // Bonus points for brightness within optimal range for finger pad (slightly darker than tip)
  if (brightness > 60 && brightness < 160) confidence += 10;
  
  confidence = Math.min(100, confidence);
  
  // Make detection more permissive by requiring fewer conditions
  const basicDetection = 
    (isBrightEnough && isRedDominant) || 
    (isRedHighest && isRedIntenseEnough && notTooIntense) ||
    (hasHumanSkinPattern && isBrightEnough);

  // Lower confidence threshold for positive detection
  const fingerDetected = basicDetection && confidence > 35; // Reduced from 40 to 35

  // Incorporar estabilización con histórico
  detectionHistory.push(fingerDetected);
  if (detectionHistory.length > HISTORY_SIZE) {
    detectionHistory.shift();
  }
  
  // La detección final es estable si al menos 2 de las últimas N detecciones son positivas
  const stableDetection = 
    detectionHistory.length >= 3 &&
    detectionHistory.filter(d => d).length >= 2; // More permissive - only need 2 positives
  
  // Aplicar suavizado temporal de la calidad mediante EMA
  const alpha = 0.35; // Increased from 0.3 to 0.35 for faster adaptation
  previousConfidence = alpha * confidence + (1 - alpha) * previousConfidence;
  const finalConfidence = Math.round(previousConfidence);

  // Log more details for debugging
  console.log(`Finger metrics: R:${avgRed.toFixed(0)} G:${avgGreen.toFixed(0)} B:${avgBlue.toFixed(0)} Bright:${brightness.toFixed(0)} RedDom:${redDominance.toFixed(0)} Skin%:${skinColorPercentage.toFixed(0)} Conf:${finalConfidence} Detected:${stableDetection || fingerDetected}`);

  return {
    detected: stableDetection || fingerDetected,
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
  
  // Fórmula mejorada para calidad de señal PPG (más permisiva para yema del dedo)
  
  // Factor de dominancia de rojo (ideal: >15 para yema)
  const redDominanceFactor = Math.min(100, Math.max(0, (metrics.redDominance / 30) * 100)); // Reduced from 35 to 30
  
  // Factor de brillo (ideal: 70-180 en escala 0-255 para yema) - rango ampliado y ajustado para yema
  const idealBrightness = 130; // Reduced from 150 to 130 for finger pad
  const brightnessDeviation = Math.abs(metrics.brightness - idealBrightness);
  const brightnessFactor = Math.max(0, 100 - (brightnessDeviation / 1.8)); // More permissive (1.5 to 1.8)
  
  // Factor de intensidad de rojo (ideal: 80-200 para yema) - rango ajustado
  const redIntensityFactor = metrics.redIntensity < 80 ? 
    Math.min(100, (metrics.redIntensity / 80) * 80) : 
    Math.min(100, (1 - (metrics.redIntensity - 80) / 120) * 100);
  
  // Factor de contraste rojo-verde (importante para detectar pulsaciones)
  const redGreenContrastFactor = Math.min(100, Math.max(0, 
    (metrics.redIntensity - metrics.greenIntensity) * 7)); // Increased from 6 to 7
  
  // Ponderación de factores (ajustada para priorizar características de la yema)
  const quality = (
    redDominanceFactor * 0.35 +    // Reduced from 0.4 to 0.35
    brightnessFactor * 0.3 +       // Increased from 0.25 to 0.3
    redIntensityFactor * 0.25 +    // Same
    redGreenContrastFactor * 0.1   // Same
  );
  
  return Math.round(quality);
}
