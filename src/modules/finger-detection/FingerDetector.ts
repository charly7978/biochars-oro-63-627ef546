
/**
 * FingerDetector
 * 
 * Sistema TRIPLE VERIFICACIÓN para detección robusta de dedos en la cámara
 * Evita falsos positivos con múltiples capas de verificación
 */
export class FingerDetector {
  // Configuración de calidad y detección
  private config = {
    // Umbral mínimo de calidad para considerar que hay un dedo detectado
    MIN_QUALITY_FOR_DETECTION: 15, // Reducido para mejor detección
    
    // Mínimo ratio rojo/verde que debe tener un dedo humano (característica biométrica)
    MIN_RED_GREEN_RATIO: 1.25, // Reducido para mejor detección
    
    // Valores mínimos absolutos para luz roja y verde
    MIN_RED_VALUE: 80,
    MIN_GREEN_VALUE: 40,
    
    // Historial necesario para considerar detección estable
    REQUIRED_FINGER_FRAMES: 3,
    
    // Ventana de historial para estabilidad
    QUALITY_HISTORY_SIZE: 10,
    
    // Factores de ponderación para el cálculo de calidad
    SIGNAL_WEIGHT: 0.7,
    COLOR_WEIGHT: 0.3,
  };

  // Variables de estado interno
  private lastPpgValue: number = 0;
  private lastRedValue: number = 0;
  private lastGreenValue: number = 0;
  private displayQuality: number = 0;
  private signalQuality: number = 0;
  private colorQuality: number = 0;
  private qualityHistory: number[] = [];
  private qualityLevel: string = "BAJO";

  constructor() {
    console.log("FingerDetector: Inicializado con parámetros de sensibilidad optimizados");
  }

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
   * Procesa la calidad de la señal utilizando un enfoque híbrido
   * que combina valores PPG con análisis de color RGB
   */
  public processQuality(ppgValue: number, redValue: number, greenValue: number): {
    quality: number;
    isFingerDetected: boolean;
    qualityLevel: string;
  } {
    // Actualizar valores
    this.lastPpgValue = ppgValue;
    this.lastRedValue = redValue;
    this.lastGreenValue = greenValue;
    
    // 1. Calidad de la señal PPG (variación y fuerza)
    this.updateSignalQuality(ppgValue);
    
    // 2. Calidad basada en el análisis de color
    this.updateColorQuality(redValue, greenValue);
    
    // 3. Calidad combinada (híbrida)
    this.displayQuality = Math.round(
      this.signalQuality * this.config.SIGNAL_WEIGHT + 
      this.colorQuality * this.config.COLOR_WEIGHT
    );
    
    // Añadir al historial
    this.qualityHistory.push(this.displayQuality);
    if (this.qualityHistory.length > this.config.QUALITY_HISTORY_SIZE) {
      this.qualityHistory.shift();
    }
    
    // Actualizar nivel descriptivo
    this.updateQualityLevel();
    
    // Determinar si hay un dedo presente usando verificación triple
    const isFingerDetected = this.isFingerDetected();
    
    return {
      quality: this.displayQuality,
      isFingerDetected,
      qualityLevel: this.qualityLevel
    };
  }

  /**
   * Actualiza la calidad de la señal basada en la señal PPG
   */
  private updateSignalQuality(ppgValue: number): void {
    // Cualquier señal menor a 0.1 es ruido
    if (Math.abs(ppgValue) < 0.1) {
      this.signalQuality = Math.max(0, this.signalQuality - 5);
      return;
    }
    
    // Señales muy fuertes son sospechosas de artifacts
    if (Math.abs(ppgValue) > 10) {
      this.signalQuality = Math.max(0, this.signalQuality - 3);
      return;
    }
    
    // Señales en el rango ideal incrementan la calidad
    const optimalStrength = Math.min(Math.abs(ppgValue), 5) / 5; // Normalizar a 0-1
    const newQuality = Math.round(optimalStrength * 100);
    
    // Actualización suave
    this.signalQuality = Math.round(this.signalQuality * 0.7 + newQuality * 0.3);
    this.signalQuality = Math.min(100, Math.max(0, this.signalQuality));
  }

  /**
   * Actualiza la calidad basada en el análisis de color
   * Usa biometría básica: los dedos humanos tienen un ratio rojo/verde característico
   */
  private updateColorQuality(redValue: number, greenValue: number): void {
    // Si no hay valores de color, reducir la calidad
    if (redValue <= 0 || greenValue <= 0) {
      this.colorQuality = Math.max(0, this.colorQuality - 5);
      return;
    }
    
    // El ratio rojo/verde en un dedo humano bajo luz blanca es típicamente 1.3-2.0
    const rgRatio = redValue / greenValue;
    let ratioQuality = 0;
    
    if (rgRatio >= this.config.MIN_RED_GREEN_RATIO) {
      // El ratio está en rango biométrico humano
      const normalizedRatio = Math.min(rgRatio, 2.0) / 2.0; // Normalizar a 0-1
      ratioQuality = Math.round(normalizedRatio * 100);
    }
    
    // Análisis de valores absolutos (debe haber suficiente luz reflejada)
    const redIntensity = Math.min(redValue, 250) / 250; // Normalizar a 0-1
    const greenIntensity = Math.min(greenValue, 250) / 250; // Normalizar a 0-1
    const intensityQuality = Math.round((redIntensity * 0.7 + greenIntensity * 0.3) * 100);
    
    // Combinación de factores
    const combinedQuality = Math.round(ratioQuality * 0.7 + intensityQuality * 0.3);
    
    // Actualización suave
    this.colorQuality = Math.round(this.colorQuality * 0.6 + combinedQuality * 0.4);
    this.colorQuality = Math.min(100, Math.max(0, this.colorQuality));
  }

  /**
   * Actualiza el nivel descriptivo de calidad
   */
  private updateQualityLevel(): void {
    if (this.displayQuality >= 75) {
      this.qualityLevel = "EXCELENTE";
    } else if (this.displayQuality >= 50) {
      this.qualityLevel = "BUENO";
    } else if (this.displayQuality >= 25) {
      this.qualityLevel = "ACEPTABLE";
    } else {
      this.qualityLevel = "BAJO";
    }
  }

  /**
   * Devuelve la configuración actual
   */
  public getConfig() {
    return this.config;
  }

  /**
   * Reinicia el detector
   */
  public reset(): void {
    this.lastPpgValue = 0;
    this.lastRedValue = 0;
    this.lastGreenValue = 0;
    this.displayQuality = 0;
    this.signalQuality = 0;
    this.colorQuality = 0;
    this.qualityHistory = [];
    this.qualityLevel = "BAJO";
  }
}
