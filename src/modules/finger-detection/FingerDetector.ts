
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

type DeviceType = 'android' | 'ios' | 'unknown';

interface FingerDetectionConfig {
  REQUIRED_FINGER_FRAMES: number;
  MIN_QUALITY_FOR_DETECTION: number;
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
 * Clase dedicada para la detección de dedo en la cámara
 * Completamente rediseñada para eliminación de falsos positivos
 */
export class FingerDetector {
  private qualityHistory: number[] = [];
  private consecutiveGoodFrames: number = 0;
  private lastQualityLevel: string = '';
  private deviceType: DeviceType = 'unknown';
  private displayQuality: number = 0;
  private baselineValue: number = 0;
  private redValues: number[] = [];
  private greenValues: number[] = [];
  private rgRatioHistory: number[] = [];
  
  // Configuración con umbrales más estrictos
  private config: FingerDetectionConfig = {
    REQUIRED_FINGER_FRAMES: 6,         // Más exigente
    MIN_QUALITY_FOR_DETECTION: 20,     // Umbral mínimo más alto
    QUALITY_THRESHOLD: 65,             // Mayor exigencia de calidad
    LOW_QUALITY_THRESHOLD: 35,         // Mayor exigencia en umbral bajo
    RESET_QUALITY_THRESHOLD: 10        // Más sensible a pérdida de señal
  };
  
  // Mayor historial para tomar decisiones más robustas
  private readonly historySize = 12;
  
  constructor() {
    this.detectDeviceType();
    console.log("FingerDetector: Inicializado con umbrales estrictos", {
      configuración: this.config,
      dispositivo: this.deviceType,
      umbralDetección: this.config.MIN_QUALITY_FOR_DETECTION
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
   * @param quality Valor de calidad (0-100)
   * @param redValue Valor del canal rojo (opcional)
   * @param greenValue Valor del canal verde (opcional)
   * @returns Resultado de la detección con información completa
   */
  public processQuality(quality: number, redValue?: number, greenValue?: number): FingerDetectionResult {
    // Procesar valores RGB si están disponibles (detección fisiológica)
    if (redValue !== undefined && greenValue !== undefined) {
      this.redValues.push(redValue);
      this.greenValues.push(greenValue);
      
      if (this.redValues.length > 10) {
        this.redValues.shift();
        this.greenValues.shift();
      }
      
      // Calcular ratio R/G (importante en tejido vivo)
      if (greenValue > 0) {
        const rgRatio = redValue / greenValue;
        this.rgRatioHistory.push(rgRatio);
        
        if (this.rgRatioHistory.length > 10) {
          this.rgRatioHistory.shift();
        }
      }
    }
    
    // Criterios más estrictos de detección fisiológica
    const isPhysiologicallyValid = this.checkPhysiologicalValidity();
    
    // Log de depuración cada 30 frames
    if (this.redValues.length % 30 === 0 && this.redValues.length > 0) {
      console.log("FingerDetector: Análisis fisiológico", {
        valorRojo: redValue,
        valorVerde: greenValue,
        ratioRG: this.rgRatioHistory.length > 0 ? 
                this.rgRatioHistory[this.rgRatioHistory.length-1] : 0,
        calidadSeñal: quality,
        validaciónFisiológica: isPhysiologicallyValid
      });
    }
    
    // Si la calidad es muy baja, reiniciar historial
    if (quality < this.config.RESET_QUALITY_THRESHOLD) {
      if (this.qualityHistory.length > 0) {
        this.qualityHistory = [];
        this.displayQuality = 0;
        this.consecutiveGoodFrames = 0;
      }
    } 
    // Si la calidad supera el umbral mínimo Y es fisiológicamente válida
    else if (quality > this.config.MIN_QUALITY_FOR_DETECTION && isPhysiologicallyValid) {
      this.qualityHistory.push(quality);
      if (this.qualityHistory.length > this.historySize) {
        this.qualityHistory.shift();
      }
    } 
    // Si la calidad es baja o no válida fisiológicamente
    else {
      // No aceptamos datos no válidos
      if (this.qualityHistory.length > 0) {
        this.qualityHistory = [];
        this.displayQuality = 0;
        this.consecutiveGoodFrames = 0;
      }
    }
    
    // Calcular calidad a mostrar (más conservadora)
    this.updateDisplayQuality();
    
    // Determinar nivel de calidad actual
    const qualityLevel = this.getQualityText(this.displayQuality);
    if (qualityLevel !== this.lastQualityLevel) {
      this.lastQualityLevel = qualityLevel;
    }
    
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
   * Verifica validez fisiológica con múltiples criterios
   * Implementado según investigación médica sobre características
   * ópticas del tejido vivo
   */
  private checkPhysiologicalValidity(): boolean {
    // Sin suficientes datos, no podemos validar
    if (this.redValues.length < 5 || this.greenValues.length < 5) {
      return false;
    }
    
    // 1. Verificar ratio R/G del tejido vivo (debe estar en rango)
    // Valores típicos para piel humana: 1.1-2.0
    const avgRgRatio = this.rgRatioHistory.length > 0
      ? this.rgRatioHistory.reduce((a, b) => a + b, 0) / this.rgRatioHistory.length
      : 0;
    
    if (avgRgRatio < 1.2 || avgRgRatio > 2.5) {
      return false;
    }
    
    // 2. Verificar variabilidad temporal (pulsatilidad)
    // Calcular desviación estándar de valores recientes
    const redStdDev = this.calculateStdDev(this.redValues);
    const greenStdDev = this.calculateStdDev(this.greenValues);
    
    // En tejido vivo, el canal rojo muestra mayor variabilidad
    if (redStdDev < 0.8 || redStdDev < greenStdDev) {
      return false;
    }
    
    // 3. Verificar nivel absoluto (no demasiado oscuro o brillante)
    const avgRed = this.redValues.reduce((a, b) => a + b, 0) / this.redValues.length;
    if (avgRed < 60 || avgRed > 230) {
      return false;
    }
    
    // 4. NUEVO: Verificar periodicidad en señal roja (característica de pulso)
    const redDiffs = [];
    for (let i = 1; i < this.redValues.length; i++) {
      redDiffs.push(this.redValues[i] - this.redValues[i-1]);
    }
    
    // Contar cambios de signo (indicadores de oscilación)
    let signChanges = 0;
    for (let i = 1; i < redDiffs.length; i++) {
      if ((redDiffs[i] > 0 && redDiffs[i-1] < 0) || 
          (redDiffs[i] < 0 && redDiffs[i-1] > 0)) {
        signChanges++;
      }
    }
    
    // Debe haber al menos un cambio de dirección para ser señal de pulso
    if (signChanges < 1 && this.redValues.length > 8) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Calcula desviación estándar de un array de valores
   */
  private calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
  
  /**
   * Actualiza el valor de calidad para mostrar de forma más robusta
   */
  private updateDisplayQuality(): void {
    // Sin datos, calidad cero
    if (this.qualityHistory.length === 0) {
      this.displayQuality = 0;
      this.consecutiveGoodFrames = 0;
      return;
    }
    
    // Frames insuficientes, mostrar calidad parcial (más conservador)
    if (this.qualityHistory.length < this.config.REQUIRED_FINGER_FRAMES) {
      const lastQuality = this.qualityHistory[this.qualityHistory.length - 1];
      this.displayQuality = Math.max(0, Math.min(15, lastQuality));
      return;
    }
    
    // Calcular calidad con media recortada (elimina outliers)
    const sortedQuality = [...this.qualityHistory].sort((a, b) => a - b);
    const trimAmount = Math.floor(sortedQuality.length * 0.2); // Recortar 20% superior e inferior
    const trimmedQuality = sortedQuality.slice(trimAmount, sortedQuality.length - trimAmount);
    
    const avgQuality = trimmedQuality.length > 0
      ? trimmedQuality.reduce((a, b) => a + b, 0) / trimmedQuality.length
      : 0;
    
    // Verificar consistencia (importante para eliminar falsos positivos)
    const minQuality = Math.min(...this.qualityHistory);
    const maxQuality = Math.max(...this.qualityHistory);
    const range = maxQuality - minQuality;
    
    // Penalizar inconsistencia fuertemente
    let finalQuality = avgQuality;
    if (range > 40) {
      finalQuality = finalQuality * 0.6; // Penalización más severa
    }
    
    // Actualizar con suavizado más conservador
    this.displayQuality = Math.round(
      this.displayQuality * 0.65 + finalQuality * 0.35
    );
    
    // Actualizar contador de frames buenos consecutivos
    if (finalQuality > this.config.QUALITY_THRESHOLD) {
      this.consecutiveGoodFrames++;
    } else {
      this.consecutiveGoodFrames = 0;
    }
  }
  
  /**
   * Determina si hay un dedo presente con criterios más estrictos
   */
  public isFingerDetected(): boolean {
    // Requisitos más estrictos para la detección
    return this.displayQuality >= this.config.MIN_QUALITY_FOR_DETECTION && 
           this.qualityHistory.length >= this.config.REQUIRED_FINGER_FRAMES &&
           this.checkPhysiologicalValidity();
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
      return "Cubra completamente la cámara trasera y el flash con su dedo índice. Presione firmemente pero no muy fuerte.";
    }
    
    // Con dedo pero baja calidad
    if (this.displayQuality < this.config.LOW_QUALITY_THRESHOLD) {
      if (this.deviceType === 'android') {
        return "Presione más firmemente y asegúrese que su dedo cubra tanto la cámara como el flash. Evite movimientos.";
      } else if (this.deviceType === 'ios') {
        return "Cubra completamente la cámara trasera. Presione con firmeza moderada y mantenga el dedo quieto.";
      } else {
        return "Asegúrese que su dedo cubra la cámara trasera y manténgalo quieto. Evite presionar demasiado fuerte.";
      }
    }
    
    // Calidad media
    if (this.displayQuality < this.config.QUALITY_THRESHOLD) {
      return "Buen avance. Mantenga esta posición y evite movimientos durante toda la medición.";
    }
    
    // Buena calidad
    return "¡Buena señal! Mantenga esta misma presión y posición para resultados óptimos.";
  }
  
  /**
   * Reinicia por completo el detector
   */
  public reset(): void {
    this.qualityHistory = [];
    this.consecutiveGoodFrames = 0;
    this.displayQuality = 0;
    this.lastQualityLevel = '';
    this.redValues = [];
    this.greenValues = [];
    this.rgRatioHistory = [];
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
