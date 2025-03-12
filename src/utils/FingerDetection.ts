
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
    redThreshold = 40,             // Much lower threshold for better sensitivity
    brightnessThreshold = 20,      // Much lower for better detection in low light
    redDominanceThreshold = 10,    // Lower for more permissive detection
    regionSize = 70,               // Larger region for better analysis
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

  // Analizar solo la región central
  for (let y = startY; y < startY + regionHeightPx; y++) {
    for (let x = startX; x < startX + regionWidthPx; x++) {
      const idx = (y * width + x) * 4;
      
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      
      // Make skin color detection much more permissive
      const isSkinColor = (
        r > g * 1.02 &&           // Almost equal is fine
        r > b * 1.05 &&           // Much more permissive
        r > 30 &&                 // Very low minimum red
        g > 15 &&                 // Very low minimum green
        b > 5                     // Very low minimum blue
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
  
  // Ratios de color específicos para piel humana - much more permissive
  const redGreenRatio = avgRed / (avgGreen || 1);
  const redBlueRatio = avgRed / (avgBlue || 1);
  
  // Rangos extremadamente permisivos para piel humana
  const hasHumanSkinPattern = 
    redGreenRatio > 1.02 &&         // Almost equal colors are acceptable
    redBlueRatio > 1.05 &&          // Very permissive
    skinColorPercentage > 20;       // Very low requirement
    
  // Umbrales adaptativos
  let currentRedThreshold = redThreshold;
  let currentBrightnessThreshold = brightnessThreshold;
  let currentRedDominanceThreshold = redDominanceThreshold;
  
  if (adaptiveMode) {
    // Adaptar a condiciones de luz de manera más permisiva
    if (brightness > 180) {
      // Ambiente muy brillante: ser un poco más exigente
      currentRedThreshold *= 1.2;
      currentRedDominanceThreshold *= 1.3;
    } else if (brightness < 80) {
      // Ambiente con poca luz: ser mucho más permisivo
      currentRedThreshold *= 0.5;
      currentBrightnessThreshold *= 0.5;
      currentRedDominanceThreshold *= 0.6;
    }
    
    // Si detectamos muchos píxeles de piel, podemos ser menos exigentes
    if (skinColorPercentage > 50) {
      currentRedDominanceThreshold *= 0.7;
    }
    
    // Si la imagen es muy oscura, reducir aún más los umbrales
    if (brightness < 50) {
      currentBrightnessThreshold = Math.max(10, currentBrightnessThreshold * 0.4);
      currentRedThreshold = Math.max(20, currentRedThreshold * 0.4);
    }
  }

  // Criterios de detección extremadamente permisivos
  const isBrightEnough = brightness > currentBrightnessThreshold;
  const isRedDominant = redDominance > currentRedDominanceThreshold;
  const isRedHighest = avgRed > avgGreen * 1.05 && avgRed > avgBlue * 1.08; // Barely higher
  const isRedIntenseEnough = avgRed > currentRedThreshold;
  const notTooIntense = avgRed < maxIntensityThreshold && 
                        avgGreen < maxIntensityThreshold && 
                        avgBlue < maxIntensityThreshold;
  
  // Evaluación de variación temporal
  const redVariation = maxRed - minRed;
  const hasGoodVariation = redVariation > 3; // Very small variation is acceptable
  
  // Cálculo de confianza ajustado (extremadamente permisivo)
  let confidence = 0;
  
  if (isBrightEnough) confidence += 25;         // Increased significantly
  if (isRedDominant) confidence += 25;          // Increased
  if (isRedHighest) confidence += 20;           // Increased
  if (isRedIntenseEnough) confidence += 20;     // Increased
  if (notTooIntense) confidence += 10;          // Keep same
  if (hasGoodVariation) confidence += 15;       // Increased
  if (hasHumanSkinPattern) confidence += 30;    // Increased significantly
  if (skinColorPercentage > 20) confidence += 25; // Very low threshold, high points
  
  confidence = Math.min(100, confidence);
  
  // Criterios de detección extremadamente permisivos
  const basicDetection = 
    isBrightEnough && 
    (isRedDominant || isRedHighest) && // Only one of these needed
    isRedIntenseEnough &&
    notTooIntense;

  // Require much lower confidence
  const fingerDetected = basicDetection && confidence > 30; // Extremely low threshold

  // Incorporate multiple detection modes for better reliability
  const colorBasedDetection = isRedHighest && isRedIntenseEnough && isBrightEnough;
  const patternBasedDetection = hasHumanSkinPattern && notTooIntense;
  
  // Accept detection if either method works
  const multiMethodDetection = colorBasedDetection || patternBasedDetection;

  // Incorporate stabilization with history
  detectionHistory.push(fingerDetected || multiMethodDetection);
  if (detectionHistory.length > HISTORY_SIZE) {
    detectionHistory.shift();
  }
  
  // La detección final es estable con criterio más permisivo
  const stableDetection = 
    detectionHistory.length >= 3 &&
    detectionHistory.filter(d => d).length > (detectionHistory.length / 3); // Only need 1/3 positive
  
  // Apply temporal smoothing with faster adaptation
  const alpha = 0.4; // Faster adaptation
  previousConfidence = alpha * confidence + (1 - alpha) * previousConfidence;
  const finalConfidence = Math.round(previousConfidence);

  // Better logging with important info
  console.log(`Finger metrics: R:${avgRed.toFixed(0)} G:${avgGreen.toFixed(0)} B:${avgBlue.toFixed(0)} Bright:${brightness.toFixed(0)} RedDom:${redDominance.toFixed(0)} Skin%:${skinColorPercentage.toFixed(0)} Conf:${finalConfidence} Detected:${fingerDetected || multiMethodDetection || stableDetection}`);

  return {
    detected: stableDetection || fingerDetected || multiMethodDetection,
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
  
  // Fórmula mejorada para calidad de señal PPG (mucho más permisiva)
  
  // Factor de dominancia de rojo (ideal: >15)
  const redDominanceFactor = Math.min(100, Math.max(0, (metrics.redDominance / 25) * 100));
  
  // Factor de brillo (ideal: 80-220 en escala 0-255) - rango mucho más amplio
  const idealBrightness = 150;
  const brightnessDeviation = Math.abs(metrics.brightness - idealBrightness);
  const brightnessFactor = Math.max(0, 100 - (brightnessDeviation / 2.0)); // Mucho más permisivo
  
  // Factor de intensidad de rojo (ideal: 70-220 en escala 0-255) - rango mucho más amplio
  const redIntensityFactor = metrics.redIntensity < 70 ? 
    Math.min(100, (metrics.redIntensity / 70) * 80) : 
    Math.min(100, (1 - (metrics.redIntensity - 70) / 150) * 100);
  
  // Factor de contraste rojo-verde (importante para detectar pulsaciones)
  const redGreenContrastFactor = Math.min(100, Math.max(0, 
    (metrics.redIntensity - metrics.greenIntensity) * 8)); // Aumentado significativamente
  
  // Ponderación de factores (ajustada para ser más permisiva)
  const quality = (
    redDominanceFactor * 0.3 +    
    brightnessFactor * 0.25 +     
    redIntensityFactor * 0.25 +   
    redGreenContrastFactor * 0.2  // Increased importance of contrast  
  );
  
  // Add a minimum quality level for detected fingers
  return Math.max(30, Math.round(quality));
}
