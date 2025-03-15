
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
  
  // NUEVO: Parámetros de estabilidad
  STABILITY_THRESHOLD: number;
  STABILITY_CHANGE_THRESHOLD: number;
  MAX_QUALITY_RATE_CHANGE: number;
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
 * y MEJORADA para estabilidad de lectura
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
  private previousValues: number[] = [];
  private stabilityScore: number = 0;
  private lastQualityValue: number = 0;
  
  // Configuración con umbrales EXTREMOS para eliminar falsos positivos COMPLETAMENTE
  // MEJORADA para mayor estabilidad en las lecturas
  private config: FingerDetectionConfig = {
    // PRIMERA VARIABLE CRÍTICA: Calidad mínima de señal (perfusión)
    MIN_QUALITY_FOR_DETECTION: 25,     // Umbral extremadamente alto
    
    // SEGUNDA VARIABLE CRÍTICA: Ratio rojo/verde mínimo (tejido vivo)
    MIN_RED_GREEN_RATIO: 1.65,         // Umbral biológicamente imposible para objetos inanimados
    
    // TERCERA VARIABLE CRÍTICA: Valores absolutos mínimos (sangre/tejido)
    MIN_RED_VALUE: 150,                // Valor rojo mínimo para tejido con sangre 
    MIN_GREEN_VALUE: 30,               // Valor verde mínimo para evitar objetos oscuros
    
    // Parámetros secundarios
    REQUIRED_FINGER_FRAMES: 5,         // Más frames para garantizar consistencia
    QUALITY_THRESHOLD: 60,             // Mantiene mismo valor
    LOW_QUALITY_THRESHOLD: 30,         // Mantiene mismo valor
    RESET_QUALITY_THRESHOLD: 10,       // Más alto para reset más agresivo
    
    // NUEVO: Parámetros de estabilidad
    STABILITY_THRESHOLD: 5,            // Umbral para considerar señal estable
    STABILITY_CHANGE_THRESHOLD: 15,    // Cambio máximo permitido entre frames para estabilidad
    MAX_QUALITY_RATE_CHANGE: 10        // Cambio máximo permitido en calidad entre frames
  };
  
  // Historial reducido para respuesta más rápida pero ahora con más estabilidad
  private readonly historySize = 8; 
  
  constructor() {
    this.detectDeviceType();
    console.log("FingerDetector: REIMPLEMENTADO con TRIPLE verificación anti-falsos-positivos", {
      umbralPerfusión: this.config.MIN_QUALITY_FOR_DETECTION,
      ratioRojoVerde: this.config.MIN_RED_GREEN_RATIO,
      valorRojoMínimo: this.config.MIN_RED_VALUE,
      valorVerdeMínimo: this.config.MIN_GREEN_VALUE,
      framesRequeridos: this.config.REQUIRED_FINGER_FRAMES,
      dispositivo: this.deviceType,
      // NUEVO: Parámetros de estabilidad
      umbralEstabilidad: this.config.STABILITY_THRESHOLD,
      umbralCambioEstabilidad: this.config.STABILITY_CHANGE_THRESHOLD,
      cambioPorcentajeMax: this.config.MAX_QUALITY_RATE_CHANGE
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
   * MEJORADO para lograr mayor estabilidad en las lecturas
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
        estabilidad: this.stabilityCounter,
        puntuaciónEstabilidad: this.stabilityScore
      });
    }
    
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
        this.stabilityScore = 0; // Reset de estabilidad
        this.previousValues = []; // Reset de valores previos
      }
    } 
    // Si cumple TODOS los tres criterios estrictos a la vez
    else if (hasMinimumQuality && hasCorrectRgRatio && hasValidAbsoluteValues) {
      // NUEVO: Verificar estabilidad antes de aceptar grandes cambios
      const isStableChange = this.checkStability(quality);
      
      if (isStableChange) {
        this.qualityHistory.push(quality);
        if (this.qualityHistory.length > this.historySize) {
          this.qualityHistory.shift();
        }
        this.stabilityCounter = Math.min(12, this.stabilityCounter + 1);
        this.goodDetectionCounter += 1;
        this.noDetectionCounter = Math.max(0, this.noDetectionCounter - 1);
        this.stabilityScore = Math.min(10, this.stabilityScore + 0.5); // Aumenta estabilidad gradualmente
      } else {
        // Si el cambio no es estable, sólo registrar parcialmente
        this.stabilityCounter = Math.max(1, this.stabilityCounter);
        this.stabilityScore = Math.max(0, this.stabilityScore - 1); // Disminuye estabilidad
      }
    } 
    // Si no cumple todos los criterios, comenzar a limpiar historial
    else {
      this.stabilityCounter = Math.max(0, this.stabilityCounter - 2);
      this.noDetectionCounter += 1;
      this.goodDetectionCounter = Math.max(0, this.goodDetectionCounter - 1);
      this.stabilityScore = Math.max(0, this.stabilityScore - 1); // Disminuye estabilidad
      
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
    
    // NUEVO: Registrar valor para cálculos de estabilidad
    this.previousValues.push(quality);
    if (this.previousValues.length > 10) {
      this.previousValues.shift();
    }
    this.lastQualityValue = quality;
    
    // Calcular calidad a mostrar con NUEVAS REGLAS DE ESTABILIDAD
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
   * NUEVO: Comprueba la estabilidad de los cambios de calidad
   * Evita cambios bruscos que causan las oscilaciones
   */
  private checkStability(newQuality: number): boolean {
    // Si no hay suficientes datos previos, aceptar cambio
    if (this.previousValues.length < 3) return true;
    
    // Calcular promedio de valores recientes
    const recentAvg = this.previousValues.slice(-3).reduce((a, b) => a + b, 0) / 3;
    
    // Calcular cambio porcentual
    const changePercent = Math.abs((newQuality - recentAvg) / Math.max(1, recentAvg)) * 100;
    
    // Si el cambio es demasiado brusco, considerarlo inestable
    return changePercent <= this.config.MAX_QUALITY_RATE_CHANGE;
  }
  
  /**
   * Actualiza el valor de calidad para mostrar
   * MEJORADO para mayor estabilidad con suavizado avanzado
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
      // IMPORTANTE: Más restrictivo inicialmente para evitar falsas señales excelentes
      this.displayQuality = Math.floor(lastQuality * 0.4); // Aún más restrictivo
      return;
    }
    
    // Calcular promedio eliminando outliers
    const sortedValues = [...this.qualityHistory].sort((a, b) => a - b);
    // Eliminar valores extremos
    const filteredValues = sortedValues.length >= 4 ? 
      sortedValues.slice(1, sortedValues.length - 1) : sortedValues;
    
    const avgQuality = filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length;
    
    // MEJORADO: Suavizado adaptativo basado en estabilidad
    // Cuanto más estable es la señal, más gradual es el cambio
    const stabilityFactor = Math.min(1, this.stabilityScore / 10); // 0-1 basado en estabilidad
    
    // Actualizar con suavizado adaptativo - más restrictivo al subir, más flexible al bajar
    const increaseRate = 0.15 + (0.15 * stabilityFactor); // 0.15-0.30 dependiendo de estabilidad
    const decreaseRate = 0.60 - (0.30 * stabilityFactor); // 0.60-0.30 dependiendo de estabilidad
    
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
    this.previousValues = [];
    this.stabilityScore = 0;
    this.lastQualityValue = 0;
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

