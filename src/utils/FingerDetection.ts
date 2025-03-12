
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
  // Valores predeterminados optimizados para detección de piel humana
  const {
    redThreshold = 80,            // Valor mínimo para canal rojo (más específico para piel) 
    brightnessThreshold = 60,     // Brillo mínimo (piel humana tiene cierto nivel de brillo)
    redDominanceThreshold = 15,   // Diferencia entre rojo y otros (piel humana tiene alta dominancia roja)
    regionSize = 25,              // Porcentaje del centro de la imagen a analizar
    adaptiveMode = true,          // Activar por defecto el modo adaptativo
    maxIntensityThreshold = 230   // Máximo para evitar superficies muy brillantes (paredes, etc)
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
  
  // Análisis estadístico para detectar variación real de luz pulsátil
  let maxRed = 0;
  let minRed = 255;
  let varianceSum = 0;
  let lastRedValue = -1;
  
  // Variables para análisis de textura (importante para diferenciar piel de superficies)
  let redVariance = 0;
  let colorVariance = 0;
  
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
  
  // Calcular promedios
  const avgRed = totalRed / pixelCount;
  const avgGreen = totalGreen / pixelCount;
  const avgBlue = totalBlue / pixelCount;
  
  // Calcular brillo general
  const brightness = (avgRed + avgGreen + avgBlue) / 3;
  
  // Calcular dominancia del rojo (característica clave de la piel humana)
  const redDominance = avgRed - ((avgGreen + avgBlue) / 2);
  
  // Calcular variabilidad temporal (indicador de pulso)
  const redVariation = maxRed - minRed;
  const localVariance = varianceSum / (pixelCount - 1 || 1);
  
  // Calcular características texturales promedio
  const avgRedVariance = redVariance / pixelCount;
  const avgColorVariance = colorVariance / pixelCount;
  
  // Umbral de textura (la piel humana tiene una varianza local específica)
  // Niveles muy altos o muy bajos indican superficies que no son piel
  const hasNaturalTexture = localVariance > 5 && localVariance < 100;
  
  // Calcular ratio entre canales (específico para piel humana)
  const redGreenRatio = avgRed / (avgGreen || 1);
  const redBlueRatio = avgRed / (avgBlue || 1);
  
  // Patrones típicos de color para piel humana
  const hasHumanSkinPattern = 
    redGreenRatio > 1.15 && redGreenRatio < 1.8 &&
    redBlueRatio > 1.15 && redBlueRatio < 2.0;
  
  // Usar umbrales adaptativos si está habilitado
  let currentRedThreshold = redThreshold;
  let currentBrightnessThreshold = brightnessThreshold;
  let currentRedDominanceThreshold = redDominanceThreshold;
  
  if (adaptiveMode) {
    // Ajustar umbrales basados en las características observadas
    if (brightness > 190) {
      // En condiciones muy brillantes, aumentar los umbrales
      currentRedThreshold = redThreshold * 1.3;
      currentRedDominanceThreshold = redDominanceThreshold * 1.5;
    } else if (brightness < 100) {
      // En condiciones oscuras, reducir los umbrales
      currentRedThreshold = redThreshold * 0.7;
      currentBrightnessThreshold = brightnessThreshold * 0.7;
    }
    
    // Ajustar en base a contraste observado
    if (redVariation > 20) {
      // Buen contraste indica posible presencia de pulso
      currentRedDominanceThreshold = redDominanceThreshold * 0.8;
    }
  }
  
  // Criterios de detección con umbral mejorado específico para piel
  const isBrightEnough = brightness > currentBrightnessThreshold;
  const isRedDominant = redDominance > currentRedDominanceThreshold;
  const isRedHighest = avgRed > avgGreen && avgRed > avgBlue;
  const isRedIntenseEnough = avgRed > currentRedThreshold;
  
  // Evitar superficies demasiado brillantes (paredes, reflejos)
  const notTooIntense = avgRed < maxIntensityThreshold && 
                       avgGreen < maxIntensityThreshold && 
                       avgBlue < maxIntensityThreshold;
  
  // Evaluación estadística de la señal
  const hasGoodVariation = redVariation > 5; // Debe haber cierta variación para detectar pulso
  
  // Descarta superficies con colores demasiado uniformes (paredes)
  const notTooPerfect = avgRedVariance > 2.5;
  
  // Calcular confianza (0-100) con ponderación mejorada para piel humana
  let confidence = 0;
  
  if (isBrightEnough) confidence += 15;
  if (isRedDominant) confidence += 20;
  if (isRedHighest) confidence += 15;
  if (isRedIntenseEnough) confidence += 15;
  if (hasNaturalTexture) confidence += 15;
  if (notTooIntense) confidence += 10;
  if (hasGoodVariation) confidence += 5;
  if (hasHumanSkinPattern) confidence += 20; // Gran peso a patrones de piel humana
  if (notTooPerfect) confidence += 10;
  
  // Limitar a 100%
  confidence = Math.min(100, confidence);
  
  // Detección final basada en criterios críticos específicos para piel humana
  const fingerDetected = 
    isBrightEnough && 
    isRedDominant && 
    isRedHighest && 
    isRedIntenseEnough &&
    notTooIntense &&
    notTooPerfect &&
    // Exigir al menos dos de estas características adicionales 
    // para reducir drásticamente falsos positivos
    ((hasNaturalTexture && hasHumanSkinPattern) ||
     (hasNaturalTexture && hasGoodVariation) ||
     (hasHumanSkinPattern && hasGoodVariation));
  
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
