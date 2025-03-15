
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

type DeviceType = 'android' | 'ios' | 'unknown';

interface FingerDetectionConfig {
  // PRIMERA VARIABLE CRÍTICA: Umbral de perfusión
  MIN_QUALITY_FOR_DETECTION: number;
  
  // SEGUNDA VARIABLE CRÍTICA: Ratio rojo/verde mínimo
  MIN_RED_GREEN_RATIO: number;
  
  // Parámetros secundarios
  REQUIRED_FINGER_FRAMES: number;
  QUALITY_THRESHOLD: number;
  LOW_QUALITY_THRESHOLD: number;
  RESET_QUALITY_THRESHOLD: number;
}

interface FingerDetectionResult {
  isFingerDetected: boolean;
  quality: number;
  qualityLevel: string;
  qualityColor: string;
  helpMessage: string;
}

/**
 * Clase simplificada para la detección de dedo en la cámara
 * Basada en solo dos variables críticas
 */
export class FingerDetector {
  private qualityHistory: number[] = [];
  private consecutiveGoodFrames: number = 0;
  private lastQualityLevel: string = '';
  private deviceType: DeviceType = 'unknown';
  private displayQuality: number = 0;
  private lastRedValue: number = 0;
  private lastGreenValue: number = 0;
  
  // Configuración simplificada con solo dos variables críticas principales
  // VALORES AJUSTADOS para reducir falsos positivos sin bloquear detecciones legítimas
  private config: FingerDetectionConfig = {
    // PRIMERA VARIABLE CRÍTICA: Calidad mínima de señal (perfusión)
    MIN_QUALITY_FOR_DETECTION: 12,     // Reducido para mejor detección
    
    // SEGUNDA VARIABLE CRÍTICA: Ratio rojo/verde mínimo
    MIN_RED_GREEN_RATIO: 1.2,          // Levemente reducido para mejor detección
    
    // Parámetros secundarios (menos críticos) - ajustados para mejor respuesta
    REQUIRED_FINGER_FRAMES: 2,         // Reducido para respuesta más rápida
    QUALITY_THRESHOLD: 60,             // Menos exigente para facilitar detección
    LOW_QUALITY_THRESHOLD: 30,         // Menos exigente para mejor respuesta
    RESET_QUALITY_THRESHOLD: 8         // Menos sensible a pérdida de señal
  };
  
  // Historial reducido para respuesta más rápida
  private readonly historySize = 5; // Reducido para respuesta más inmediata
  
  constructor() {
    this.detectDeviceType();
    console.log("FingerDetector: Inicializado con detección simplificada", {
      umbralPerfusión: this.config.MIN_QUALITY_FOR_DETECTION,
      ratioRojoVerde: this.config.MIN_RED_GREEN_RATIO,
      dispositivo: this.deviceType
    });
  }
  
  /**
   * Detecta el tipo de dispositivo para personalizar mensajes
   */
  private detectDeviceType(): void {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/android/i.test(userAgent)) {
      this.deviceType = 'android';
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
      this.deviceType = 'ios';
    } else {
      this.deviceType = 'unknown';
    }
  }
  
  /**
   * Procesa un nuevo valor de calidad de señal y actualiza el estado
   * Simplificado para usar solo dos variables críticas
   * MEJORADO para reducir falsos positivos sin bloquear detecciones legítimas
   */
  public processQuality(quality: number, redValue?: number, greenValue?: number): FingerDetectionResult {
    // Actualizar valores RGB si están disponibles
    if (redValue !== undefined && greenValue !== undefined) {
      this.lastRedValue = redValue;
      this.lastGreenValue = greenValue;
    }
    
    // CRITERIO 1: Verificar calidad mínima (perfusión) - criterio más flexible
    const hasMinimumQuality = quality >= this.config.MIN_QUALITY_FOR_DETECTION;
    
    // CRITERIO 2: Verificar ratio rojo/verde (tejido vivo) - más flexible
    let hasCorrectRgRatio = true; // Por defecto true si no hay valores RGB
    if (this.lastRedValue > 0 && this.lastGreenValue > 0) {
      const rgRatio = this.lastRedValue / this.lastGreenValue;
      // Criterio ligeramente más flexible para evitar bloqueos
      hasCorrectRgRatio = rgRatio >= this.config.MIN_RED_GREEN_RATIO;
      
      // Log simplificado para entender el proceso de detección
      if (Math.random() < 0.02) { // Solo logear ocasionalmente
        console.log("FingerDetector: Análisis", {
          calidad: quality,
          umbralCalidad: this.config.MIN_QUALITY_FOR_DETECTION,
          ratioRG: rgRatio,
          umbralRatioRG: this.config.MIN_RED_GREEN_RATIO,
          dedoDetectado: hasMinimumQuality && hasCorrectRgRatio
        });
      }
    }
    
    // Si la calidad es muy baja, reiniciar historial - umbral más bajo
    if (quality < this.config.RESET_QUALITY_THRESHOLD) {
      if (this.qualityHistory.length > 0) {
        this.qualityHistory = [];
        this.displayQuality = 0;
        this.consecutiveGoodFrames = 0;
      }
    } 
    // Si cumple los dos criterios críticos o está muy cerca
    else if (hasMinimumQuality && (hasCorrectRgRatio || quality > this.config.MIN_QUALITY_FOR_DETECTION * 1.5)) {
      this.qualityHistory.push(quality);
      if (this.qualityHistory.length > this.historySize) {
        this.qualityHistory.shift();
      }
    } 
    // Si no cumple los criterios, limpiar historial pero con más gradualidad
    else {
      if (this.qualityHistory.length > 0) {
        // Reducción gradual del historial para evitar cambios bruscos
        if (this.qualityHistory.length > 1) {
          this.qualityHistory.shift();
        } else {
          this.qualityHistory = [];
        }
        this.displayQuality = Math.max(0, this.displayQuality - 5);
        this.consecutiveGoodFrames = Math.max(0, this.consecutiveGoodFrames - 1);
      }
    }
    
    // Calcular calidad a mostrar (simplificado)
    this.updateDisplayQuality();
    
    // Determinar nivel de calidad actual
    const qualityLevel = this.getQualityText(this.displayQuality);
    this.lastQualityLevel = qualityLevel;
    
    // Generar resultado completo
    return {
      isFingerDetected: this.isFingerDetected(),
      quality: this.displayQuality,
      qualityLevel: qualityLevel,
      qualityColor: this.getQualityColor(this.displayQuality),
      helpMessage: this.getHelpMessage()
    };
  }
  
  /**
   * Actualiza el valor de calidad para mostrar
   * MEJORADO con transiciones más suaves
   */
  private updateDisplayQuality(): void {
    // Sin datos, calidad cero
    if (this.qualityHistory.length === 0) {
      this.displayQuality = 0;
      this.consecutiveGoodFrames = 0;
      return;
    }
    
    // Frames insuficientes, mostrar calidad parcial pero más generosa
    if (this.qualityHistory.length < this.config.REQUIRED_FINGER_FRAMES) {
      const lastQuality = this.qualityHistory[this.qualityHistory.length - 1];
      this.displayQuality = Math.floor(lastQuality * 0.7); // Mostrar calidad más cercana a la real
      return;
    }
    
    // Calcular promedio simple
    const avgQuality = this.qualityHistory.reduce((a, b) => a + b, 0) / 
                       this.qualityHistory.length;
    
    // Actualizar con suavizado simple pero más receptivo a mejoras
    const increaseRate = 0.6; // Más rápido al subir
    const decreaseRate = 0.4; // Más lento al bajar
    
    if (avgQuality > this.displayQuality) {
      this.displayQuality = Math.round(
        this.displayQuality * (1 - increaseRate) + avgQuality * increaseRate
      );
    } else {
      this.displayQuality = Math.round(
        this.displayQuality * (1 - decreaseRate) + avgQuality * decreaseRate
      );
    }
    
    // Actualizar contador de frames buenos consecutivos
    if (avgQuality > this.config.QUALITY_THRESHOLD) {
      this.consecutiveGoodFrames++;
    } else {
      this.consecutiveGoodFrames = Math.max(0, this.consecutiveGoodFrames - 0.5);
    }
  }
  
  /**
   * Determina si hay un dedo presente con criterios simplificados
   * MEJORADO para reducir falsos positivos sin bloquear detecciones legítimas
   */
  public isFingerDetected(): boolean {
    // CRITERIOS SIMPLIFICADOS Y MÁS FLEXIBLES:
    // 1. Calidad mínima con umbral reducido
    // 2. Suficientes frames consecutivos (reducido)
    // 3. Ratio R/G correcto pero con más tolerancia
    
    const hasMinimumQuality = this.displayQuality >= this.config.MIN_QUALITY_FOR_DETECTION;
    
    // Más flexible con la cantidad de frames
    const hasEnoughFrames = this.qualityHistory.length >= Math.max(1, this.config.REQUIRED_FINGER_FRAMES - 1);
    
    let hasCorrectRgRatio = true; // Por defecto true si no hay valores RGB
    if (this.lastRedValue > 0 && this.lastGreenValue > 0) {
      const rgRatio = this.lastRedValue / this.lastGreenValue;
      
      // Criterio más flexible para el ratio R/G
      // Si la calidad es muy buena, ser más flexible con el ratio
      if (this.displayQuality > this.config.QUALITY_THRESHOLD) {
        hasCorrectRgRatio = rgRatio >= (this.config.MIN_RED_GREEN_RATIO * 0.95);
      } else {
        hasCorrectRgRatio = rgRatio >= this.config.MIN_RED_GREEN_RATIO;
      }
    }
    
    return hasMinimumQuality && hasEnoughFrames && hasCorrectRgRatio;
  }
  
  /**
   * Obtiene el color asociado a la calidad de señal
   */
  private getQualityColor(quality: number): string {
    if (quality === 0 || !this.isFingerDetected()) 
      return '#666666';
    if (quality > 80) return '#059669'; // Verde más saturado
    if (quality > 65) return '#10b981'; // Verde medio
    if (quality > 50) return '#22c55e'; // Verde normal
    if (quality > 35) return '#a3e635'; // Verde-amarillo
    if (quality > 20) return '#eab308'; // Amarillo
    if (quality > 10) return '#f97316'; // Naranja
    if (quality > 5) return '#ef4444';  // Rojo
    return '#b91c1c';                   // Rojo oscuro
  }
  
  /**
   * Obtiene el texto descriptivo para el nivel de calidad
   */
  private getQualityText(quality: number): string {
    if (quality === 0 || !this.isFingerDetected()) 
      return 'Sin Dedo';
    if (quality > 80) return 'Excelente';
    if (quality > 65) return 'Muy Buena';
    if (quality > 50) return 'Buena';
    if (quality > 35) return 'Aceptable';
    if (quality > 20) return 'Baja';
    if (quality > 10) return 'Muy Baja';
    return 'Crítica';
  }
  
  /**
   * Obtiene un mensaje de ayuda basado en la plataforma y calidad
   */
  private getHelpMessage(): string {
    // Sin dedo detectado
    if (!this.isFingerDetected()) {
      return "Cubra completamente la cámara trasera y el flash con su dedo índice. Presione firmemente.";
    }
    
    // Con dedo pero baja calidad
    if (this.displayQuality < this.config.LOW_QUALITY_THRESHOLD) {
      if (this.deviceType === 'android') {
        return "Presione más firmemente y asegúrese que su dedo cubra tanto la cámara como el flash.";
      } else if (this.deviceType === 'ios') {
        return "Cubra completamente la cámara trasera. Presione con firmeza moderada.";
      } else {
        return "Asegúrese que su dedo cubra la cámara trasera y manténgalo quieto.";
      }
    }
    
    // Calidad media
    if (this.displayQuality < this.config.QUALITY_THRESHOLD) {
      return "Buen avance. Mantenga esta posición y evite movimientos.";
    }
    
    // Buena calidad
    return "¡Buena señal! Mantenga esta misma presión y posición.";
  }
  
  /**
   * Reinicia por completo el detector
   */
  public reset(): void {
    this.qualityHistory = [];
    this.consecutiveGoodFrames = 0;
    this.displayQuality = 0;
    this.lastQualityLevel = '';
    this.lastRedValue = 0;
    this.lastGreenValue = 0;
    console.log("FingerDetector: Detector reiniciado completamente");
  }
  
  /**
   * Obtiene la configuración actual
   */
  public getConfig(): FingerDetectionConfig {
    return {...this.config};
  }
}

// Exportación de interfaces para uso en otros módulos
export type { FingerDetectionConfig, FingerDetectionResult, DeviceType };
