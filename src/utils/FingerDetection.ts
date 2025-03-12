
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
}

/**
 * Analiza una región de imagen para detectar la presencia de un dedo
 * Utiliza múltiples métricas para una detección más precisa
 */
export function detectFinger(
  imageData: ImageData, 
  options: DetectionOptions = {}
): FingerDetectionResult {
  // Valores predeterminados más sensibles que funcionan bien en diferentes condiciones de luz
  const {
    redThreshold = 70,            // Valor mínimo para canal rojo (más bajo = más sensible)
    brightnessThreshold = 40,     // Brillo mínimo (más bajo = más sensible)
    redDominanceThreshold = 5,    // Diferencia mínima entre rojo y otros canales
    regionSize = 30               // Porcentaje del centro de la imagen a analizar
  } = options;

  // Calcular dimensiones y coordenadas de la región central
  const width = imageData.width;
  const height = imageData.height;
  const regionWidthPx = Math.floor(width * (regionSize / 100));
  const regionHeightPx = Math.floor(height * (regionSize / 100));
  
  const startX = Math.floor((width - regionWidthPx) / 2);
  const startY = Math.floor((height - regionHeightPx) / 2);
  
  // Acumuladores para los canales de color
  let totalRed = 0;
  let totalGreen = 0;
  let totalBlue = 0;
  let pixelCount = 0;
  
  // Analizar solo la región central
  for (let y = startY; y < startY + regionHeightPx; y++) {
    for (let x = startX; x < startX + regionWidthPx; x++) {
      // Calcular el índice del píxel en el array de datos
      const idx = (y * width + x) * 4;
      
      // Extraer valores RGB
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      
      // Acumular valores
      totalRed += r;
      totalGreen += g;
      totalBlue += b;
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
  
  // Calcular promedios
  const avgRed = totalRed / pixelCount;
  const avgGreen = totalGreen / pixelCount;
  const avgBlue = totalBlue / pixelCount;
  
  // Calcular brillo general
  const brightness = (avgRed + avgGreen + avgBlue) / 3;
  
  // Calcular dominancia del rojo
  const redDominance = avgRed - ((avgGreen + avgBlue) / 2);
  
  // Criterios de detección
  const isBrightEnough = brightness > brightnessThreshold;
  const isRedDominant = redDominance > redDominanceThreshold;
  const isRedHighest = avgRed > avgGreen && avgRed > avgBlue;
  const isRedIntenseEnough = avgRed > redThreshold;
  
  // Calcular confianza (0-100)
  let confidence = 0;
  
  if (isBrightEnough) confidence += 25;
  if (isRedDominant) confidence += 25;
  if (isRedHighest) confidence += 25;
  if (isRedIntenseEnough) confidence += 25;
  
  // Detección final basada en criterios múltiples
  const fingerDetected = 
    isBrightEnough && 
    isRedDominant && 
    isRedHighest && 
    isRedIntenseEnough;
  
  return {
    detected: fingerDetected,
    confidence,
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
  
  // Señal de alta calidad tiene:
  // 1. Alta dominancia de rojo (sangre)
  // 2. Buen brillo (ni muy oscuro ni saturado)
  // 3. Intensidad de canal rojo significativa
  
  // Factor de dominancia de rojo (ideal: >25)
  const redDominanceFactor = Math.min(100, Math.max(0, (metrics.redDominance / 40) * 100));
  
  // Factor de brillo (ideal: 100-200 en escala 0-255)
  const brightnessDeviation = Math.abs(metrics.brightness - 150);
  const brightnessFactor = Math.max(0, 100 - (brightnessDeviation / 1.5));
  
  // Factor de intensidad de rojo (ideal: >120 en escala 0-255)
  const redIntensityFactor = Math.min(100, (metrics.redIntensity / 200) * 100);
  
  // Ponderación de factores
  const quality = (
    redDominanceFactor * 0.5 +
    brightnessFactor * 0.3 +
    redIntensityFactor * 0.2
  );
  
  return Math.round(quality);
}
