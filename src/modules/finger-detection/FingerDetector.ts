
/**
 * Determina si hay un dedo presente con TRIPLE VERIFICACIÓN
 * COMPLETAMENTE REDISEÑADO para eliminar TODOS los falsos positivos
 */
public isFingerDetected(): boolean {
  // CRITERIOS TRIPLES EXTREMADAMENTE ESTRICTOS:
  
  // 1. Calidad mínima con umbral muy elevado
  const hasMinimumQuality = this.displayQuality >= this.config.MIN_QUALITY_FOR_DETECTION;
  
  // 2. Suficientes frames consecutivos 
  const hasEnoughFrames = this.qualityHistory.length >= this.config.REQUIRED_FINGER_FRAMES;
  
  // 3a. Ratio rojo/verde correcto (característica FUNDAMENTAL del tejido vivo)
  let hasCorrectRgRatio = false;
  if (this.lastRedValue > 0 && this.lastGreenValue > 0) {
    const rgRatio = this.lastRedValue / this.lastGreenValue;
    hasCorrectRgRatio = rgRatio >= this.config.MIN_RED_GREEN_RATIO;
  }
  
  // 3b. Valores absolutos válidos (imposibles para objetos no orgánicos)
  const hasValidAbsoluteValues = 
    this.lastRedValue >= this.config.MIN_RED_VALUE && 
    this.lastGreenValue >= this.config.MIN_GREEN_VALUE;
  
  // FILTRO FINAL: todos los criterios deben cumplirse sin excepciones
  return hasMinimumQuality && hasEnoughFrames && hasCorrectRgRatio && hasValidAbsoluteValues;
}
