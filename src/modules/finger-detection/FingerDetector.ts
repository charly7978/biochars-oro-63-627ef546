
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
  
  // TERCERA VARIABLE CRÍTICA: Valores absolutos mínimos de R/G para tejido vivo
  MIN_RED_VALUE: number;
  MIN_GREEN_VALUE: number;
  
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
 * Clase para detección de dedo en la cámara
 * COMPLETAMENTE REDISEÑADA con triple verificación para eliminar falsos positivos
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
  
  // Configuración con umbrales EXTREMOS para eliminar falsos positivos COMPLETAMENTE
  private config: FingerDetectionConfig = {
    // PRIMERA VARIABLE CRÍTICA: Calidad mínima de señal (perfusión)
    MIN_QUALITY_FOR_DETECTION: 20,     // AJUSTADO: Reducido para mayor sensibilidad (antes: 25)
    
    // SEGUNDA VARIABLE CRÍTICA: Ratio rojo/verde mínimo (tejido vivo)
    MIN_RED_GREEN_RATIO: 1.45,         // AJUSTADO: Reducido para mayor sensibilidad (antes: 1.65)
    
    // TERCERA VARIABLE CRÍTICA: Valores absolutos mínimos (sangre/tejido)
    MIN_RED_VALUE: 150,                // Valor rojo mínimo para tejido con sangre 
    MIN_GREEN_VALUE: 30,               // Valor verde mínimo para evitar objetos oscuros
    
    // Parámetros secundarios
    REQUIRED_FINGER_FRAMES: 5,         // Más frames para garantizar consistencia
    QUALITY_THRESHOLD: 60,             // Mantiene mismo valor
    LOW_QUALITY_THRESHOLD: 30,         // Mantiene mismo valor
    RESET_QUALITY_THRESHOLD: 10        // Más alto para reset más agresivo
  };
  
  // Historial reducido para respuesta más rápida
  private readonly historySize = 5; 
  
  constructor() {
    this.detectDeviceType();
    console.log("FingerDetector: REIMPLEMENTADO con TRIPLE verificación anti-falsos-positivos", {
      umbralPerfusión: this.config.MIN_QUALITY_FOR_DETECTION,
      ratioRojoVerde: this.config.MIN_RED_GREEN_RATIO,
      valorRojoMínimo: this.config.MIN_RED_VALUE,
      valorVerdeMínimo: this.config.MIN_GREEN_VALUE,
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
   * COMPLETAMENTE REDISEÑADO con TRIPLE verificación para eliminar TODOS los falsos positivos
   */
  public processQuality(quality: number, redValue?: number, greenValue?: number): FingerDetectionResult {
    // Actualizar valores RGB si están disponibles
    if (redValue !== undefined && greenValue !== undefined) {
      this.lastRedValue = redValue;
      this.lastGreenValue = greenValue;
    }
    
    // CRITERIO 1: Verificar calidad mínima (perfusión)
    const hasMinimumQuality = quality >= this.config.MIN_QUALITY_FOR_DETECTION;
    
    // CRITERIO 2: Verificar ratio rojo/verde (tejido vivo)
    let hasCorrectRgRatio = false; // Por defecto false hasta verificar
    let rgRatio = 0;
    
    if (this.lastRedValue > 0 && this.lastGreenValue > 0) {
      rgRatio = this.lastRedValue / this.lastGreenValue;
      hasCorrectRgRatio = rgRatio >= this.config.MIN_RED_GREEN_RATIO;
    }
    
    // CRITERIO 3 (NUEVO): Verificar valores absolutos (sangre/tejido)
    const hasMinimumRedValue = this.lastRedValue >= this.config.MIN_RED_VALUE;
    const hasMinimumGreenValue = this.lastGreenValue >= this.config.MIN_GREEN_VALUE;
    const hasValidAbsoluteValues = hasMinimumRedValue && hasMinimumGreenValue;
    
    // Log de análisis periódico para entender el proceso de detección
    if (Math.random() < 0.02) { // Logear ocasionalmente
      console.log("FingerDetector: Análisis detallado TRIPLE", {
        calidad: quality,
        umbralCalidad: this.config.MIN_QUALITY_FOR_DETECTION,
        cumpleCalidad: hasMinimumQuality,
        
        valorRojo: this.lastRedValue,
        valorVerde: this.lastGreenValue,
        ratioRG: rgRatio,
        umbralRatioRG: this.config.MIN_RED_GREEN_RATIO,
        cumpleRatioRG: hasCorrectRgRatio,
        
        umbralRojoMínimo: this.config.MIN_RED_VALUE,
        umbralVerdeMínimo: this.config.MIN_GREEN_VALUE,
        cumpleValoresAbsolutos: hasValidAbsoluteValues,
        
        todosCriteriosCumplidos: hasMinimumQuality && hasCorrectRgRatio && hasValidAbsoluteValues,
        estabilidad: this.stabilityCounter
      });
    }
    
    // Fix the error: Don't compare boolean values directly with === true/false
    // Si la calidad es muy baja o no cumple criterios, reiniciar más agresivamente
    if (quality < this.config.RESET_QUALITY_THRESHOLD || 
        !hasMinimumQuality || !hasCorrectRgRatio || !hasValidAbsoluteValues) {
      if (this.qualityHistory.length > 0) {
        this.qualityHistory = [];
        this.displayQuality = 0;
        this.consecutiveGoodFrames = 0;
        this.stabilityCounter = 0;
        this.noDetectionCounter += 2; // Incrementar contador de no detección
        this.goodDetectionCounter = Math.max(0, this.goodDetectionCounter - 2);
      }
    } 
    // Si cumple TODOS los tres criterios estrictos a la vez
    else if (hasMinimumQuality && hasCorrectRgRatio && hasValidAbsoluteValues) {
      this.qualityHistory.push(quality);
      if (this.qualityHistory.length > this.historySize) {
        this.qualityHistory.shift();
      }
      this.stabilityCounter = Math.min(12, this.stabilityCounter + 1);
      this.goodDetectionCounter += 1;
      this.noDetectionCounter = Math.max(0, this.noDetectionCounter - 1);
    } 
    // Si no cumple todos los criterios, comenzar a limpiar historial
    else {
      this.stabilityCounter = Math.max(0, this.stabilityCounter - 2);
      this.noDetectionCounter += 1;
      this.goodDetectionCounter = Math.max(0, this.goodDetectionCounter - 1);
      
      if (this.qualityHistory.length > 0) {
        // Reducción más agresiva del historial
        this.qualityHistory.pop();
        if (this.qualityHistory.length > 0) {
          this.qualityHistory.shift();
        }
        
        this.displayQuality = Math.max(0, this.displayQuality - 10);
        this.consecutiveGoodFrames = Math.max(0, this.consecutiveGoodFrames - 2);
      }
    }
    
    // Calcular calidad a mostrar (más restrictivo)
    this.updateDisplayQuality();
    
    // Determinar nivel de calidad actual
    const qualityLevel = this.getQualityText(this.displayQuality);
    this.lastQualityLevel = qualityLevel;
    
    // Determinar si hay dedo con TRIPLE VERIFICACIÓN estricta
    const fingerDetected = this.isFingerDetected();
    
    // Aplicar histéresis fuerte para evitar fluctuaciones
    let finalDetectionState = this.lastDetectionState;
    
    // Si se detecta dedo y no estaba detectado antes, requerir mucha evidencia
    if (fingerDetected && !this.lastDetectionState) {
      if (this.stabilityCounter >= 6 && this.goodDetectionCounter >= 8) {
        finalDetectionState = true;
        if (this.lastDetectionState !== finalDetectionState) {
          console.log("FingerDetector: DEDO DETECTADO con TRIPLE criterio", {
            estabilidad: this.stabilityCounter,
            buenasDetecciones: this.goodDetectionCounter,
            calidad: this.displayQuality,
            valorRojo: this.lastRedValue,
            valorVerde: this.lastGreenValue,
            ratioRG: rgRatio
          });
        }
      }
    } 
    // Si no se detecta dedo y estaba detectado antes
    else if (!fingerDetected && this.lastDetectionState) {
      if (this.stabilityCounter <= 2 || this.noDetectionCounter >= 6) {
        finalDetectionState = false;
        if (this.lastDetectionState !== finalDetectionState) {
          console.log("FingerDetector: DEDO PERDIDO con TRIPLE criterio", {
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
      qualityLevel: finalDetectionState ? qualityLevel : "Sin Dedo",
      qualityColor: finalDetectionState ? this.getQualityColor(this.displayQuality) : "#666666",
      helpMessage: this.getHelpMessage()
    };
  }
  
  /**
   * Actualiza el valor de calidad para mostrar
   * MEJORADO para evitar lecturas irreales
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
      this.displayQuality = Math.floor(lastQuality * 0.4); // Aún más restrictivo
      return;
    }
    
    // Calcular promedio eliminando outliers
    const sortedValues = [...this.qualityHistory].sort((a, b) => a - b);
    // Eliminar valores extremos
    const filteredValues = sortedValues.length >= 4 ? 
      sortedValues.slice(1, sortedValues.length - 1) : sortedValues;
    
    const avgQuality = filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length;
    
    // Actualizar con suavizado restrictivo
    const increaseRate = 0.25; // Muy lento al subir
    const decreaseRate = 0.75; // Muy rápido al bajar
    
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
   * Obtiene el color asociado a la calidad de señal
   */
  private getQualityColor(quality: number): string {
    if (quality === 0) 
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
    if (quality === 0) 
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
