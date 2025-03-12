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

/**
 * Analiza una región de imagen para detectar la presencia de un dedo
 * Utiliza múltiples métricas para una detección más precisa
 */
export function detectFinger(
  imageData: ImageData, 
  options: DetectionOptions = {}
): FingerDetectionResult {
  const {
    redThreshold = 100,            // Aumentado para exigir más rojo (característico de piel)
    brightnessThreshold = 70,      // Aumentado para requerir mejor iluminación
    redDominanceThreshold = 25,    // Aumentado para exigir mayor diferencia rojo vs otros
    regionSize = 25,               // Mantener región de análisis
    adaptiveMode = true,           // Mantener modo adaptativo
    maxIntensityThreshold = 245    // Aumentado para evitar reflejos más eficientemente
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
  let varianceSum = 0;
  let lastRedValue = -1;
  let redVariance = 0;
  let colorVariance = 0;
  let skinColorPixels = 0;      // Contador para píxeles que cumplen criterios de piel

  // Analizar solo la región central
  for (let y = startY; y < startY + regionHeightPx; y++) {
    for (let x = startX; x < startX + regionWidthPx; x++) {
      const idx = (y * width + x) * 4;
      
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      
      // Criterios específicos de color de piel
      const isSkinColor = (
        r > g * 1.2 &&           // Rojo debe ser significativamente mayor que verde
        r > b * 1.3 &&           // Y aún mayor que azul
        g > b &&                 // Verde mayor que azul (típico en piel)
        r > 80 && r < 240 &&     // Rango válido para rojo
        g > 40 && g < 200 &&     // Rango válido para verde
        b > 20 && b < 180        // Rango válido para azul
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
      
      // Calcular varianza local para detectar textura de piel
      if (lastRedValue >= 0) {
        const diff = r - lastRedValue;
        varianceSum += diff * diff;
        
        // Acumulación para varianza de color (la piel humana tiene patrones específicos)
        redVariance += Math.abs(r - totalRed / (pixelCount || 1));
        colorVariance += Math.abs(r - g) + Math.abs(r - b) + Math.abs(g - b);
      }
      lastRedValue = r;
      
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

  // Criterios más estrictos para texturas
  const localVariance = varianceSum / (pixelCount - 1 || 1);
  const hasNaturalTexture = localVariance > 8 && localVariance < 80;
  
  // Ratios de color específicos para piel humana
  const redGreenRatio = avgRed / (avgGreen || 1);
  const redBlueRatio = avgRed / (avgBlue || 1);
  
  // Rangos más precisos para piel humana
  const hasHumanSkinPattern = 
    redGreenRatio > 1.2 && redGreenRatio < 1.6 &&
    redBlueRatio > 1.3 && redBlueRatio < 1.8 &&
    skinColorPercentage > 60;  // Al menos 60% de píxeles deben parecer piel

  // Umbrales adaptativos
  let currentRedThreshold = redThreshold;
  let currentBrightnessThreshold = brightnessThreshold;
  let currentRedDominanceThreshold = redDominanceThreshold;
  
  if (adaptiveMode) {
    if (brightness > 190) {
      currentRedThreshold *= 1.4;
      currentRedDominanceThreshold *= 1.6;
    } else if (brightness < 100) {
      currentRedThreshold *= 0.8;
      currentBrightnessThreshold *= 0.85;
    }
    
    if (skinColorPercentage > 80) {
      currentRedDominanceThreshold *= 0.9;
    }
  }

  // Criterios de detección más estrictos
  const isBrightEnough = brightness > currentBrightnessThreshold;
  const isRedDominant = redDominance > currentRedDominanceThreshold;
  const isRedHighest = avgRed > avgGreen * 1.2 && avgRed > avgBlue * 1.3;
  const isRedIntenseEnough = avgRed > currentRedThreshold;
  const notTooIntense = avgRed < maxIntensityThreshold && 
                       avgGreen < maxIntensityThreshold && 
                       avgBlue < maxIntensityThreshold;
  
  // Evaluación de variación temporal
  const redVariation = maxRed - minRed;
  const hasGoodVariation = redVariation > 8 && redVariation < 100;
  
  // Evitar superficies artificiales
  const notTooPerfect = redVariance > 3.5;

  // Cálculo de confianza ajustado
  let confidence = 0;
  
  if (isBrightEnough) confidence += 10;
  if (isRedDominant) confidence += 15;
  if (isRedHighest) confidence += 15;
  if (isRedIntenseEnough) confidence += 10;
  if (hasNaturalTexture) confidence += 15;
  if (notTooIntense) confidence += 10;
  if (hasGoodVariation) confidence += 10;
  if (hasHumanSkinPattern) confidence += 25;  // Mayor peso a patrones de piel
  if (notTooPerfect) confidence += 10;
  if (skinColorPercentage > 60) confidence += 20;
  
  confidence = Math.min(100, confidence);
  
  // Detección más estricta que requiere más criterios simultáneos
  const fingerDetected = 
    isBrightEnough && 
    isRedDominant && 
    isRedHighest && 
    isRedIntenseEnough &&
    notTooIntense &&
    notTooPerfect &&
    skinColorPercentage > 60 &&  // Nuevo criterio mínimo
    // Requerir al menos tres características adicionales
    ([hasNaturalTexture, hasHumanSkinPattern, hasGoodVariation]
      .filter(Boolean).length >= 2);

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
  
  // Fórmula mejorada para calidad de señal PPG
  // Valores ideales basados en múltiples estudios de precisión
  
  // Factor de dominancia de rojo (ideal: >25)
  // Las señales PPG de alta calidad muestran una fuerte dominancia del canal rojo
  const redDominanceFactor = Math.min(100, Math.max(0, (metrics.redDominance / 40) * 100));
  
  // Factor de brillo (ideal: 100-200 en escala 0-255)
  // Un brillo óptimo asegura suficiente señal sin saturación
  const idealBrightness = 150;
  const brightnessDeviation = Math.abs(metrics.brightness - idealBrightness);
  const brightnessFactor = Math.max(0, 100 - (brightnessDeviation / 1.2));
  
  // Factor de intensidad de rojo (ideal: 120-220 en escala 0-255)
  // El canal rojo debe ser suficientemente intenso pero no saturado
  const redIntensityFactor = metrics.redIntensity < 120 ? 
    Math.min(100, (metrics.redIntensity / 120) * 80) : 
    Math.min(100, (1 - (metrics.redIntensity - 120) / 135) * 100);
  
  // Factor de contraste rojo-verde (importante para detectar pulsaciones)
  // Un buen contraste entre el canal rojo y verde indica mejor captura de hemoglobina
  const redGreenContrastFactor = Math.min(100, Math.max(0, 
    (metrics.redIntensity - metrics.greenIntensity) * 5));
  
  // Ponderación de factores (ajustada para priorizar características críticas)
  const quality = (
    redDominanceFactor * 0.4 +    // Mayor peso a la dominancia del rojo (característica principal)
    brightnessFactor * 0.25 +     // Importante pero menos crítico
    redIntensityFactor * 0.25 +   // También importante
    redGreenContrastFactor * 0.1  // Factor adicional para mejor discriminación
  );
  
  return Math.round(quality);
}
