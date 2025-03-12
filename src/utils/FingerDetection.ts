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
    redThreshold = 50,             // Increased from 40 to reduce false positives
    brightnessThreshold = 30,      // Increased from 20 for better detection
    redDominanceThreshold = 15,    // Increased from 10 for more specificity to finger
    regionSize = 60,               // Reduced from 70 to focus more on center
    adaptiveMode = true,
    maxIntensityThreshold = 240    // Slightly reduced to avoid reflections
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
      
      // More specific skin color detection
      const isSkinColor = (
        r > g * 1.05 &&           // Slightly increased ratio from 1.02
        r > b * 1.10 &&           // Increased from 1.05 for better finger specificity
        r > 35 &&                 // Slightly increased minimum red
        g > 20 &&                 // Slightly increased minimum green
        b > 10                    // Slightly increased minimum blue
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
  
  // More specific ratios for human skin
  const redGreenRatio = avgRed / (avgGreen || 1);
  const redBlueRatio = avgRed / (avgBlue || 1);
  
  // More specific ranges for human skin
  const hasHumanSkinPattern = 
    redGreenRatio > 1.05 &&         // Increased from 1.02
    redBlueRatio > 1.10 &&          // Increased from 1.05
    skinColorPercentage > 25;       // Increased from 20 for more specificity
    
  // Umbrales adaptativos
  let currentRedThreshold = redThreshold;
  let currentBrightnessThreshold = brightnessThreshold;
  let currentRedDominanceThreshold = redDominanceThreshold;
  
  if (adaptiveMode) {
    // Adaptar a condiciones de luz de manera más específica
    if (brightness > 180) {
      // Ambiente muy brillante: ser más exigente
      currentRedThreshold *= 1.3;     // Increased from 1.2
      currentRedDominanceThreshold *= 1.4; // Increased from 1.3
    } else if (brightness < 80) {
      // Ambiente con poca luz: ser moderadamente permisivo
      currentRedThreshold *= 0.7;     // Increased from 0.5 (less permissive)
      currentBrightnessThreshold *= 0.6; // Increased from 0.5 (less permissive)
      currentRedDominanceThreshold *= 0.7; // Increased from 0.6 (less permissive)
    }
    
    // Si detectamos muchos píxeles de piel, podemos ser menos exigentes
    if (skinColorPercentage > 60) {  // Increased from 50
      currentRedDominanceThreshold *= 0.8; // Increased from 0.7 (less permissive)
    }
    
    // Si la imagen es muy oscura, reducir aún más los umbrales pero con límites
    if (brightness < 50) {
      currentBrightnessThreshold = Math.max(15, currentBrightnessThreshold * 0.5); // Higher min (15 vs 10)
      currentRedThreshold = Math.max(25, currentRedThreshold * 0.5); // Higher min (25 vs 20)
    }
  }

  // Criterios de detección más específicos
  const isBrightEnough = brightness > currentBrightnessThreshold;
  const isRedDominant = redDominance > currentRedDominanceThreshold;
  const isRedHighest = avgRed > avgGreen * 1.08 && avgRed > avgBlue * 1.12; // Increased ratios
  const isRedIntenseEnough = avgRed > currentRedThreshold;
  const notTooIntense = avgRed < maxIntensityThreshold && 
                        avgGreen < maxIntensityThreshold && 
                        avgBlue < maxIntensityThreshold;
  
  // Evaluación de variación temporal
  const redVariation = maxRed - minRed;
  const hasGoodVariation = redVariation > 5; // Increased from 3 for higher quality signal
  
  // Cálculo de confianza ajustado (más balanceado)
  let confidence = 0;
  
  if (isBrightEnough) confidence += 20;         // Decreased from 25
  if (isRedDominant) confidence += 25;          // Kept same
  if (isRedHighest) confidence += 22;           // Increased slightly from 20
  if (isRedIntenseEnough) confidence += 22;     // Increased slightly from 20
  if (notTooIntense) confidence += 10;          // Kept same
  if (hasGoodVariation) confidence += 18;       // Increased from 15
  if (hasHumanSkinPattern) confidence += 35;    // Increased from 30
  if (skinColorPercentage > 25) confidence += 20; // Decreased threshold, decreased points (25 from 20, 20 from 25)
  
  confidence = Math.min(100, confidence);
  
  // Criterios de detección más específicos
  const basicDetection = 
    isBrightEnough && 
    (isRedDominant || isRedHighest) && 
    isRedIntenseEnough &&
    notTooIntense;

  // Higher confidence threshold
  const fingerDetected = basicDetection && confidence > 40; // Increased from 30
  
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
  
  // La detección final es estable con criterio más específico
  const stableDetection = 
    detectionHistory.length >= 3 &&
    detectionHistory.filter(d => d).length > (detectionHistory.length * 0.4); // Require 40% positive vs 33%
  
  // Apply temporal smoothing with moderate adaptation
  const alpha = 0.3; // Decreased from 0.4 for more stability
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
