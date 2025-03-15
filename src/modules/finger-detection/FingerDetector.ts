
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
  private stabilityCounter: number = 0;
  private lastDetectionState: boolean = false;
  
  // Configuración simplificada con solo dos variables críticas principales
  // VALORES AJUSTADOS para reducir falsos positivos sin bloquear detecciones legítimas
  private config: FingerDetectionConfig = {
    // PRIMERA VARIABLE CRÍTICA: Calidad mínima de señal (perfusión)
    MIN_QUALITY_FOR_DETECTION: 15,     // Aumentado para reducir falsos positivos
    
    // SEGUNDA VARIABLE CRÍTICA: Ratio rojo/verde mínimo
    MIN_RED_GREEN_RATIO: 1.35,         // Aumentado para reducir falsos positivos
    
    // Parámetros secundarios (menos críticos) - ajustados para mejor respuesta
    REQUIRED_FINGER_FRAMES: 3,         // Aumentado para mayor estabilidad
    QUALITY_THRESHOLD: 60,             // Mantiene mismo valor
    LOW_QUALITY_THRESHOLD: 30,         // Mantiene mismo valor
    RESET_QUALITY_THRESHOLD: 8         // Mantiene mismo valor
  };
  
  // Historial reducido para respuesta más rápida
  private readonly historySize = 5; 
  
  constructor() {
    this.detectDeviceType();
    console.log("FingerDetector: Inicializado con detección anti-falsos-positivos", {
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
   * Mejorado para reducir drásticamente falsos positivos
   */
  public processQuality(quality: number, redValue?: number, greenValue?: number): FingerDetectionResult {
    // Actualizar valores RGB si están disponibles
    if (redValue !== undefined && greenValue !== undefined) {
      this.lastRedValue = redValue;
      this.lastGreenValue = greenValue;
    }
    
    // CRITERIO 1: Verificar calidad mínima (perfusión) - criterio más estricto
    const hasMinimumQuality = quality >= this.config.MIN_QUALITY_FOR_DETECTION;
    
    // CRITERIO 2: Verificar ratio rojo/verde (tejido vivo) - más estricto
    let hasCorrectRgRatio = true; // Por defecto true si no hay valores RGB
    if (this.lastRedValue > 0 && this.lastGreenValue > 0) {
      const rgRatio = this.lastRedValue / this.lastGreenValue;
      // Criterio más estricto para evitar falsos positivos
      hasCorrectRgRatio = rgRatio >= this.config.MIN_RED_GREEN_RATIO;
      
      // Log simplificado para entender el proceso de detección
      if (Math.random() < 0.01) { // Solo logear muy ocasionalmente
        console.log("FingerDetector: Análisis", {
          calidad: quality,
          umbralCalidad: this.config.MIN_QUALITY_FOR_DETECTION,
          ratioRG: rgRatio,
          umbralRatioRG: this.config.MIN_RED_GREEN_RATIO,
          dedoDetectado: hasMinimumQuality && hasCorrectRgRatio
        });
      }
    }
    
    // Si la calidad es muy baja, reiniciar historial
    if (quality < this.config.RESET_QUALITY_THRESHOLD) {
      if (this.qualityHistory.length > 0) {
        this.qualityHistory = [];
        this.displayQuality = 0;
        this.consecutiveGoodFrames = 0;
        this.stabilityCounter = 0;
      }
    } 
    // Si cumple los dos criterios críticos
    else if (hasMinimumQuality && hasCorrectRgRatio) {
      this.qualityHistory.push(quality);
      if (this.qualityHistory.length > this.historySize) {
        this.qualityHistory.shift();
      }
      this.stabilityCounter = Math.min(10, this.stabilityCounter + 1);
    } 
    // Si no cumple los criterios, limpiar historial pero con más gradualidad
    else {
      this.stabilityCounter = Math.max(0, this.stabilityCounter - 1);
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
    
    // Determinar si hay dedo con criterios mejorados anti-falsos-positivos
    const fingerDetected = this.isFingerDetected();
    
    // Aplicar histéresis para evitar fluctuaciones rápidas en la detección
    // Solo cambiamos estado si hay una tendencia clara
    if (fingerDetected !== this.lastDetectionState) {
      if ((fingerDetected && this.stabilityCounter >= 3) || 
          (!fingerDetected && this.stabilityCounter <= 1)) {
        this.lastDetectionState = fingerDetected;
      }
    }
    
    // Generar resultado completo con estado estabilizado
    return {
      isFingerDetected: this.lastDetectionState,
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
    
    // Frames insuficientes, mostrar calidad parcial pero más restrictiva
    if (this.qualityHistory.length < this.config.REQUIRED_FINGER_FRAMES) {
      const lastQuality = this.qualityHistory[this.qualityHistory.length - 1];
      this.displayQuality = Math.floor(lastQuality * 0.6); // Más restrictivo para prevenir falsos positivos
      return;
    }
    
    // Calcular promedio simple
    const avgQuality = this.qualityHistory.reduce((a, b) => a + b, 0) / 
                       this.qualityHistory.length;
    
    // Actualizar con suavizado simple pero más exigente ante perturbaciones
    const increaseRate = 0.4; // Más lento al subir para verificar tendencia real
    const decreaseRate = 0.6; // Más rápido al bajar para responder a pérdida de calidad
    
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
   * Determina si hay un dedo presente con criterios más estrictos
   * MEJORADO para reducir drásticamente falsos positivos
   */
  public isFingerDetected(): boolean {
    // CRITERIOS MÁS ESTRICTOS:
    // 1. Calidad mínima con umbral aumentado
    // 2. Suficientes frames consecutivos (aumentado)
    // 3. Ratio R/G correcto con umbral más alto
    
    const hasMinimumQuality = this.displayQuality >= this.config.MIN_QUALITY_FOR_DETECTION;
    
    // Más exigente con la cantidad de frames
    const hasEnoughFrames = this.qualityHistory.length >= this.config.REQUIRED_FINGER_FRAMES;
    
    let hasCorrectRgRatio = true; // Por defecto true si no hay valores RGB
    if (this.lastRedValue > 0 && this.lastGreenValue > 0) {
      const rgRatio = this.lastRedValue / this.lastGreenValue;
      
      // Criterio más estricto para el ratio R/G
      hasCorrectRgRatio = rgRatio >= this.config.MIN_RED_GREEN_RATIO;
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
    this.stabilityCounter = 0;
    this.lastDetectionState = false;
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
