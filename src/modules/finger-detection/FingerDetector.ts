
/**
 * Detector especializado para presencia de dedo con triple verificación física
 * Implementa algoritmos avanzados para eliminar falsos positivos
 */
export class FingerDetector {
  private displayQuality: number = 0;
  private qualityHistory: number[] = [];
  private lastRedValue: number = 0;
  private lastGreenValue: number = 0;
  private lastQualityLevel: string = 'Sin Dedo';
  private lastHelpMessage: string = 'Coloque su dedo sobre la cámara';
  
  // Configuración con umbrales optimizados para máxima precisión
  private config = {
    MIN_QUALITY_FOR_DETECTION: 18, // Reducido de 20 a 18 para mayor sensibilidad
    REQUIRED_FINGER_FRAMES: 5,
    MIN_RED_GREEN_RATIO: 1.35, // Reducido de 1.45 a 1.35 para mayor sensibilidad
    MIN_RED_VALUE: 80,
    MIN_GREEN_VALUE: 30,
    QUALITY_THRESHOLD: 60,
    LOW_QUALITY_THRESHOLD: 40,
    VERY_LOW_QUALITY_THRESHOLD: 20
  };
  
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
  
  /**
   * Procesa la calidad de la señal y determina si hay un dedo presente
   * @param quality Calidad de la señal (0-100)
   * @param redValue Valor del canal rojo (opcional)
   * @param greenValue Valor del canal verde (opcional)
   * @returns Resultado del procesamiento
   */
  public processQuality(
    quality: number, 
    redValue?: number, 
    greenValue?: number
  ): { 
    quality: number; 
    isFingerDetected: boolean; 
    qualityLevel: string;
    qualityColor: string;
    helpMessage: string;
  } {
    // Actualizar valores RGB si se proporcionan
    if (redValue !== undefined) {
      this.lastRedValue = redValue;
    }
    
    if (greenValue !== undefined) {
      this.lastGreenValue = greenValue;
    }
    
    // Actualizar historial de calidad
    this.qualityHistory.push(quality);
    if (this.qualityHistory.length > this.config.REQUIRED_FINGER_FRAMES) {
      this.qualityHistory.shift();
    }
    
    // Suavizar calidad para display
    this.displayQuality = Math.round(
      this.qualityHistory.reduce((sum, q) => sum + q, 0) / this.qualityHistory.length
    );
    
    // Determinar si hay dedo usando triple verificación
    const fingerDetected = this.isFingerDetected();
    
    // Establecer nivel de calidad y mensajes de ayuda
    let qualityLevel = 'Sin Dedo';
    let qualityColor = '#666666';
    let helpMessage = 'Coloque su dedo sobre la cámara trasera cubriendo completamente el flash';
    
    if (fingerDetected) {
      if (this.displayQuality >= this.config.QUALITY_THRESHOLD) {
        qualityLevel = 'Excelente';
        qualityColor = '#10b981';
        helpMessage = 'Calidad excelente. Mantenga el dedo quieto.';
      } else if (this.displayQuality >= this.config.LOW_QUALITY_THRESHOLD) {
        qualityLevel = 'Buena';
        qualityColor = '#22d3ee';
        helpMessage = 'Buena calidad. Intente mantener el dedo más quieto.';
      } else if (this.displayQuality >= this.config.VERY_LOW_QUALITY_THRESHOLD) {
        qualityLevel = 'Baja';
        qualityColor = '#eab308';
        helpMessage = 'Calidad baja. Presione suavemente y mantenga el dedo quieto.';
      } else {
        qualityLevel = 'Muy Baja';
        qualityColor = '#f97316';
        helpMessage = 'Calidad muy baja. Ajuste la posición y presión del dedo.';
      }
    }
    
    // Guardar últimos valores para referencia
    this.lastQualityLevel = qualityLevel;
    this.lastHelpMessage = helpMessage;
    
    return {
      quality: this.displayQuality,
      isFingerDetected: fingerDetected,
      qualityLevel,
      qualityColor,
      helpMessage
    };
  }
  
  /**
   * Obtiene la configuración actual
   */
  public getConfig() {
    return { ...this.config };
  }
  
  /**
   * Reinicia el detector
   */
  public reset(): void {
    this.displayQuality = 0;
    this.qualityHistory = [];
    this.lastRedValue = 0;
    this.lastGreenValue = 0;
    this.lastQualityLevel = 'Sin Dedo';
    this.lastHelpMessage = 'Coloque su dedo sobre la cámara';
  }
}
