
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
 * Basada en solo dos variables críticas con umbral mucho más alto para eliminar falsos positivos
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
  private noDetectionCounter: number = 0;
  private goodDetectionCounter: number = 0;
  
  // Configuración con umbrales MUY SUPERIORES para eliminar falsos positivos
  private config: FingerDetectionConfig = {
    // PRIMERA VARIABLE CRÍTICA: Calidad mínima de señal (perfusión)
    MIN_QUALITY_FOR_DETECTION: 22,     // Considerablemente más alto para eliminar falsos positivos
    
    // SEGUNDA VARIABLE CRÍTICA: Ratio rojo/verde mínimo
    MIN_RED_GREEN_RATIO: 1.45,         // Aumentado considerablemente para eliminar falsos positivos
    
    // Parámetros secundarios (menos críticos) - ajustados para mejor respuesta
    REQUIRED_FINGER_FRAMES: 4,         // Más frames requeridos para confirmar detección
    QUALITY_THRESHOLD: 60,             // Mantiene mismo valor
    LOW_QUALITY_THRESHOLD: 30,         // Mantiene mismo valor
    RESET_QUALITY_THRESHOLD: 8         // Mantiene mismo valor
  };
  
  // Historial reducido para respuesta más rápida
  private readonly historySize = 5; 
  
  constructor() {
    this.detectDeviceType();
    console.log("FingerDetector: Inicializado con detección ANTI-FALSOS-POSITIVOS MEJORADA", {
      umbralPerfusión: this.config.MIN_QUALITY_FOR_DETECTION,
      ratioRojoVerde: this.config.MIN_RED_GREEN_RATIO,
      framesRequeridos: this.config.REQUIRED_FINGER_FRAMES,
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
   * SEVERAMENTE MEJORADO para eliminar falsos positivos
   */
  public processQuality(quality: number, redValue?: number, greenValue?: number): FingerDetectionResult {
    // Actualizar valores RGB si están disponibles
    if (redValue !== undefined && greenValue !== undefined) {
      this.lastRedValue = redValue;
      this.lastGreenValue = greenValue;
    }
    
    // CRITERIO 1: Verificar calidad mínima (perfusión) - criterio MUCHO más estricto
    const hasMinimumQuality = quality >= this.config.MIN_QUALITY_FOR_DETECTION;
    
    // CRITERIO 2: Verificar ratio rojo/verde (tejido vivo) - MUCHO más estricto
    let hasCorrectRgRatio = true; // Por defecto true si no hay valores RGB
    if (this.lastRedValue > 0 && this.lastGreenValue > 0) {
      const rgRatio = this.lastRedValue / this.lastGreenValue;
      // Criterio mucho más estricto para eliminar falsos positivos
      hasCorrectRgRatio = rgRatio >= this.config.MIN_RED_GREEN_RATIO;
      
      // Log de análisis periódico para entender el proceso de detección
      if (Math.random() < 0.01) { // Solo logear muy ocasionalmente
        console.log("FingerDetector: Análisis detallado", {
          calidad: quality,
          umbralCalidad: this.config.MIN_QUALITY_FOR_DETECTION,
          ratioRG: rgRatio,
          umbralRatioRG: this.config.MIN_RED_GREEN_RATIO,
          dedoDetectado: hasMinimumQuality && hasCorrectRgRatio,
          estabilidad: this.stabilityCounter
        });
      }
    }
    
    // Si la calidad es muy baja, reiniciar historial más agresivamente
    if (quality < this.config.RESET_QUALITY_THRESHOLD) {
      if (this.qualityHistory.length > 0) {
        this.qualityHistory = [];
        this.displayQuality = 0;
        this.consecutiveGoodFrames = 0;
        this.stabilityCounter = 0;
        this.noDetectionCounter += 2; // Incrementar contador de no detección
        this.goodDetectionCounter = Math.max(0, this.goodDetectionCounter - 2);
      }
    } 
    // Si cumple los dos criterios críticos estrictos
    else if (hasMinimumQuality && hasCorrectRgRatio) {
      this.qualityHistory.push(quality);
      if (this.qualityHistory.length > this.historySize) {
        this.qualityHistory.shift();
      }
      this.stabilityCounter = Math.min(12, this.stabilityCounter + 1);
      this.goodDetectionCounter += 1;
      this.noDetectionCounter = Math.max(0, this.noDetectionCounter - 1);
    } 
    // Si no cumple los criterios, limpiar historial con eliminación más agresiva
    else {
      this.stabilityCounter = Math.max(0, this.stabilityCounter - 2); // Reducción más rápida
      this.noDetectionCounter += 1;
      this.goodDetectionCounter = Math.max(0, this.goodDetectionCounter - 1);
      
      if (this.qualityHistory.length > 0) {
        // Reducción más agresiva del historial para evitar falsos positivos
        this.qualityHistory.pop(); // Eliminar el último valor
        if (this.qualityHistory.length > 0 && Math.random() < 0.5) {
          this.qualityHistory.shift(); // 50% de probabilidad de eliminar otro valor
        }
        
        this.displayQuality = Math.max(0, this.displayQuality - 8); // Reducción más rápida
        this.consecutiveGoodFrames = Math.max(0, this.consecutiveGoodFrames - 2); // Reducción más rápida
      }
    }
    
    // Calcular calidad a mostrar (más restrictivo)
    this.updateDisplayQuality();
    
    // Determinar nivel de calidad actual
    const qualityLevel = this.getQualityText(this.displayQuality);
    this.lastQualityLevel = qualityLevel;
    
    // Determinar si hay dedo con criterios MUCHO más estrictos
    const fingerDetected = this.isFingerDetected();
    
    // Aplicar histéresis más fuerte para evitar fluctuaciones en la detección
    let finalDetectionState = this.lastDetectionState;
    
    // Si se detecta dedo y no estaba detectado antes, requerir más evidencia
    if (fingerDetected && !this.lastDetectionState) {
      if (this.stabilityCounter >= 5 && this.goodDetectionCounter >= 6) {
        finalDetectionState = true;
        if (this.lastDetectionState !== finalDetectionState) {
          console.log("FingerDetector: DEDO DETECTADO con criterios estrictos", {
            estabilidad: this.stabilityCounter,
            buenasDetecciones: this.goodDetectionCounter,
            calidad: this.displayQuality
          });
        }
      }
    } 
    // Si no se detecta dedo y estaba detectado antes, requerir evidencia sostenida
    else if (!fingerDetected && this.lastDetectionState) {
      if (this.stabilityCounter <= 2 || this.noDetectionCounter >= 8) {
        finalDetectionState = false;
        if (this.lastDetectionState !== finalDetectionState) {
          console.log("FingerDetector: DEDO PERDIDO con criterios estrictos", {
            estabilidad: this.stabilityCounter,
            noDetecciones: this.noDetectionCounter,
            calidad: this.displayQuality
          });
        }
      }
    }
    
    this.lastDetectionState = finalDetectionState;
    
    // Generar resultado completo con estado estabilizado
    return {
      isFingerDetected: finalDetectionState,
      quality: this.displayQuality,
      qualityLevel: qualityLevel,
      qualityColor: this.getQualityColor(this.displayQuality),
      helpMessage: this.getHelpMessage()
    };
  }
  
  /**
   * Actualiza el valor de calidad para mostrar
   * MEJORADO con transiciones más suaves y umbral más alto
   */
  private updateDisplayQuality(): void {
    // Sin datos, calidad cero
    if (this.qualityHistory.length === 0) {
      this.displayQuality = 0;
      this.consecutiveGoodFrames = 0;
      return;
    }
    
    // Frames insuficientes, mostrar calidad parcial pero mucho más restrictiva
    if (this.qualityHistory.length < this.config.REQUIRED_FINGER_FRAMES) {
      const lastQuality = this.qualityHistory[this.qualityHistory.length - 1];
      this.displayQuality = Math.floor(lastQuality * 0.5); // Más restrictivo para prevenir falsos positivos
      return;
    }
    
    // Calcular promedio simple pero eliminando outliers
    const sortedValues = [...this.qualityHistory].sort((a, b) => a - b);
    // Eliminar el valor más alto y más bajo si hay suficientes valores
    const filteredValues = sortedValues.length >= 4 ? 
      sortedValues.slice(1, sortedValues.length - 1) : sortedValues;
    
    const avgQuality = filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length;
    
    // Actualizar con suavizado más restrictivo
    const increaseRate = 0.3; // Aún más lento al subir para verificar tendencia real
    const decreaseRate = 0.7; // Más rápido al bajar para responder a pérdida de calidad
    
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
      this.consecutiveGoodFrames = Math.max(0, this.consecutiveGoodFrames - 1);
    }
  }
  
  /**
   * Determina si hay un dedo presente con criterios EXTREMADAMENTE estrictos
   * DRÁSTICAMENTE MEJORADO para eliminar falsos positivos
   */
  public isFingerDetected(): boolean {
    // CRITERIOS EXTREMADAMENTE ESTRICTOS:
    // 1. Calidad mínima con umbral muy elevado
    // 2. Suficientes frames consecutivos 
    // 3. Ratio R/G correcto con umbral muy elevado
    
    const hasMinimumQuality = this.displayQuality >= this.config.MIN_QUALITY_FOR_DETECTION;
    
    // Más exigente con la cantidad de frames
    const hasEnoughFrames = this.qualityHistory.length >= this.config.REQUIRED_FINGER_FRAMES;
    
    let hasCorrectRgRatio = true; // Por defecto true si no hay valores RGB
    if (this.lastRedValue > 0 && this.lastGreenValue > 0) {
      const rgRatio = this.lastRedValue / this.lastGreenValue;
      
      // Criterio mucho más estricto para el ratio R/G
      hasCorrectRgRatio = rgRatio >= this.config.MIN_RED_GREEN_RATIO;
      
      // Criterio adicional: el valor debe ser claramente superior al umbral, no justo en el límite
      if (rgRatio < this.config.MIN_RED_GREEN_RATIO + 0.05) {
        hasCorrectRgRatio = false;
      }
    }
    
    // Criterio adicional: verificar que la calidad no sea "justo" el mínimo
    // para evitar falsos positivos en el límite
    if (this.displayQuality < this.config.MIN_QUALITY_FOR_DETECTION + 3) {
      return false;
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
    if (!this.lastDetectionState) {
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
    this.noDetectionCounter = 0;
    this.goodDetectionCounter = 0;
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
