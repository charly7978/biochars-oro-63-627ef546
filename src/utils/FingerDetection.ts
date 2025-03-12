
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
    redThreshold = 85,             // Reducido para detectar dedos con menos luz
    brightnessThreshold = 40,      // Reducido para trabajar en condiciones de menor luz
    redDominanceThreshold = 20,    // Reducido para ser menos estricto
    regionSize = 50,               // Ampliado para analizar un área mayor
    adaptiveMode = true,           // Activado para adaptarse a diferentes condiciones
    maxIntensityThreshold = 245    // Mantenido para evitar reflejos
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
      
      // Criterios más permisivos para color de piel
      const isSkinColor = (
        r > g * 1.1 &&           // Reducido de 1.2 a 1.1
        r > b * 1.2 &&           // Reducido de 1.3 a 1.2
        r > 60 &&                // Reducido de 80 a 60
        g > 30 &&                // Reducido de 40 a 30
        b > 15                   // Reducido de 20 a 15
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
  
  // Ratios de color específicos para piel humana
  const redGreenRatio = avgRed / (avgGreen || 1);
  const redBlueRatio = avgRed / (avgBlue || 1);
  
  // Rangos más permisivos para piel humana
  const hasHumanSkinPattern = 
    redGreenRatio > 1.1 &&          // Reducido de 1.2 a 1.1
    redBlueRatio > 1.2 &&           // Reducido de 1.3 a 1.2
    skinColorPercentage > 40;       // Reducido de 60 a 40
    
  // Umbrales adaptativos
  let currentRedThreshold = redThreshold;
  let currentBrightnessThreshold = brightnessThreshold;
  let currentRedDominanceThreshold = redDominanceThreshold;
  
  if (adaptiveMode) {
    // Adaptar a condiciones de luz
    if (brightness > 180) {
      // Ambiente muy brillante: ser más exigente
      currentRedThreshold *= 1.3;
      currentRedDominanceThreshold *= 1.4;
    } else if (brightness < 80) {
      // Ambiente con poca luz: ser más permisivo
      currentRedThreshold *= 0.7;
      currentBrightnessThreshold *= 0.7;
      currentRedDominanceThreshold *= 0.8;
    }
    
    // Si detectamos muchos píxeles de piel, podemos ser menos exigentes
    if (skinColorPercentage > 70) {
      currentRedDominanceThreshold *= 0.8;
    }
    
    // Si la imagen es muy oscura, reducir aún más los umbrales
    if (brightness < 50) {
      currentBrightnessThreshold = Math.max(20, currentBrightnessThreshold * 0.6);
      currentRedThreshold = Math.max(30, currentRedThreshold * 0.6);
    }
  }

  // Criterios de detección más permisivos
  const isBrightEnough = brightness > currentBrightnessThreshold;
  const isRedDominant = redDominance > currentRedDominanceThreshold;
  const isRedHighest = avgRed > avgGreen * 1.1 && avgRed > avgBlue * 1.15; // Reducido de 1.2 y 1.3
  const isRedIntenseEnough = avgRed > currentRedThreshold;
  const notTooIntense = avgRed < maxIntensityThreshold && 
                        avgGreen < maxIntensityThreshold && 
                        avgBlue < maxIntensityThreshold;
  
  // Evaluación de variación temporal
  const redVariation = maxRed - minRed;
  const hasGoodVariation = redVariation > 5; // Reducido de 8
  
  // Cálculo de confianza ajustado (más permisivo)
  let confidence = 0;
  
  if (isBrightEnough) confidence += 15;
  if (isRedDominant) confidence += 20;
  if (isRedHighest) confidence += 15;
  if (isRedIntenseEnough) confidence += 15;
  if (notTooIntense) confidence += 10;
  if (hasGoodVariation) confidence += 10;
  if (hasHumanSkinPattern) confidence += 25;
  if (skinColorPercentage > 40) confidence += 15; // Reducido de 60 a 40
  
  confidence = Math.min(100, confidence);
  
  // Criterios de detección más permisivos que requieren menos combinaciones
  const basicDetection = 
    isBrightEnough && 
    isRedDominant && 
    isRedIntenseEnough &&
    notTooIntense;

  // Usamos un enfoque de confianza mínima
  const fingerDetected = basicDetection && confidence > 40; // Reducido de 55 a 40

  // Incorporar estabilización con histórico
  detectionHistory.push(fingerDetected);
  if (detectionHistory.length > HISTORY_SIZE) {
    detectionHistory.shift();
  }
  
  // La detección final es estable si la mayoría de las últimas N detecciones son positivas
  const stableDetection = 
    detectionHistory.length >= 3 &&
    detectionHistory.filter(d => d).length > (detectionHistory.length / 2);
  
  // Aplicar suavizado temporal de la calidad mediante EMA
  const alpha = 0.3; // Aumentado de 0.2 a 0.3 para adaptarse más rápido
  previousConfidence = alpha * confidence + (1 - alpha) * previousConfidence;
  const finalConfidence = Math.round(previousConfidence);

  // Imprimir métricas para depuración
  console.log(`Finger metrics: R:${avgRed.toFixed(0)} G:${avgGreen.toFixed(0)} B:${avgBlue.toFixed(0)} Bright:${brightness.toFixed(0)} RedDom:${redDominance.toFixed(0)} Skin%:${skinColorPercentage.toFixed(0)} Conf:${finalConfidence}`);

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
  
  // Fórmula mejorada para calidad de señal PPG (más permisiva)
  
  // Factor de dominancia de rojo (ideal: >20)
  const redDominanceFactor = Math.min(100, Math.max(0, (metrics.redDominance / 35) * 100));
  
  // Factor de brillo (ideal: 80-220 en escala 0-255) - rango ampliado
  const idealBrightness = 150;
  const brightnessDeviation = Math.abs(metrics.brightness - idealBrightness);
  const brightnessFactor = Math.max(0, 100 - (brightnessDeviation / 1.5)); // Más permisivo (1.2 a 1.5)
  
  // Factor de intensidad de rojo (ideal: 90-220 en escala 0-255) - rango ampliado
  const redIntensityFactor = metrics.redIntensity < 90 ? 
    Math.min(100, (metrics.redIntensity / 90) * 80) : 
    Math.min(100, (1 - (metrics.redIntensity - 90) / 135) * 100);
  
  // Factor de contraste rojo-verde (importante para detectar pulsaciones)
  const redGreenContrastFactor = Math.min(100, Math.max(0, 
    (metrics.redIntensity - metrics.greenIntensity) * 6)); // Aumentado de 5 a 6
  
  // Ponderación de factores (ajustada para priorizar características críticas)
  const quality = (
    redDominanceFactor * 0.4 +    
    brightnessFactor * 0.25 +     
    redIntensityFactor * 0.25 +   
    redGreenContrastFactor * 0.1  
  );
  
  return Math.round(quality);
}
