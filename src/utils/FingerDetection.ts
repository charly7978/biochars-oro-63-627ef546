
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
}

/**
 * Analiza una región de imagen para detectar la presencia de un dedo
 * Utiliza múltiples métricas para una detección más precisa
 */
export function detectFinger(
  imageData: ImageData, 
  options: DetectionOptions = {}
): FingerDetectionResult {
  // Valores predeterminados más exigentes para reducir falsos positivos
  const {
    redThreshold = 85,            // Valor mínimo para canal rojo (más alto = menos falsos positivos)
    brightnessThreshold = 50,     // Brillo mínimo (más alto = menos falsos positivos)
    redDominanceThreshold = 12,   // Diferencia mínima entre rojo y otros canales (más alto = menos falsos positivos)
    regionSize = 25,              // Porcentaje del centro de la imagen a analizar (más pequeño = más preciso)
    adaptiveMode = true           // Activar por defecto el modo adaptativo
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
  
  // Calcular dominancia del rojo
  const redDominance = avgRed - ((avgGreen + avgBlue) / 2);
  
  // Calcular variabilidad temporal (indicador de pulso)
  const redVariation = maxRed - minRed;
  const localVariance = varianceSum / (pixelCount - 1);
  
  // Umbral de textura (la piel humana tiene una varianza local baja)
  const textureThreshold = 100;
  const hasNaturalTexture = localVariance < textureThreshold;
  
  // Usar umbrales adaptativos si está habilitado
  let currentRedThreshold = redThreshold;
  let currentBrightnessThreshold = brightnessThreshold;
  let currentRedDominanceThreshold = redDominanceThreshold;
  
  if (adaptiveMode) {
    // Ajustar umbrales basados en las características observadas
    // Esto permite adaptarse a diferentes cámaras y condiciones de luz
    if (brightness > 200) {
      // En condiciones muy brillantes, aumentar los umbrales
      currentRedThreshold = redThreshold * 1.2;
      currentRedDominanceThreshold = redDominanceThreshold * 1.3;
    } else if (brightness < 80) {
      // En condiciones oscuras, reducir los umbrales
      currentRedThreshold = redThreshold * 0.8;
      currentBrightnessThreshold = brightnessThreshold * 0.7;
    }
    
    // Ajustar en base a contraste observado
    if (redVariation > 30) {
      // Buen contraste indica posible presencia de pulso
      currentRedDominanceThreshold = redDominanceThreshold * 0.85;
    }
  }
  
  // Criterios de detección con umbral mejorado
  const isBrightEnough = brightness > currentBrightnessThreshold;
  const isRedDominant = redDominance > currentRedDominanceThreshold;
  const isRedHighest = avgRed > avgGreen && avgRed > avgBlue;
  const isRedIntenseEnough = avgRed > currentRedThreshold;
  const hasRealisticColors = avgRed < 245 && avgGreen < 245 && avgBlue < 245; // Evitar saturación
  
  // Evaluación estadística de la señal
  const hasGoodVariation = redVariation > 8; // Debe haber cierta variación para detectar pulso
  
  // Calcular confianza (0-100) con ponderación mejorada
  let confidence = 0;
  
  if (isBrightEnough) confidence += 20;
  if (isRedDominant) confidence += 25;
  if (isRedHighest) confidence += 20;
  if (isRedIntenseEnough) confidence += 15;
  if (hasNaturalTexture) confidence += 10;
  if (hasRealisticColors) confidence += 5;
  if (hasGoodVariation) confidence += 5;
  
  // Detección final basada en criterios críticos
  // Con umbrales más exigentes para reducir falsos positivos
  const fingerDetected = 
    isBrightEnough && 
    isRedDominant && 
    isRedHighest && 
    isRedIntenseEnough &&
    hasRealisticColors;
  
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
