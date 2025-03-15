
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
 * Centraliza toda la lógica relacionada con la detección para evitar duplicación
 */
export class FingerDetector {
  private qualityHistory: number[] = [];
  private consecutiveGoodFrames: number = 0;
  private lastQualityLevel: string = '';
  private deviceType: DeviceType = 'unknown';
  private displayQuality: number = 0;
  private baselineValue: number = 0;
  
  // Configuración crítica para la detección
  private config: FingerDetectionConfig = {
    // VARIABLES CRÍTICAS - NO MODIFICAR SIN PRUEBAS EXHAUSTIVAS
    REQUIRED_FINGER_FRAMES: 1,         // Mínimo absoluto para detección inmediata
    MIN_QUALITY_FOR_DETECTION: 0.5,    // Umbral extremadamente bajo para máxima sensibilidad
    
    // Otros parámetros de configuración
    QUALITY_THRESHOLD: 40,
    LOW_QUALITY_THRESHOLD: 20,
    RESET_QUALITY_THRESHOLD: 3
  };
  
  // Tamaño de historial para cálculos de promedio
  private readonly historySize = 3;
  
  constructor() {
    // Detectar tipo de dispositivo
    this.detectDeviceType();
    console.log("FingerDetector: Inicializado con configuración:", {
      ...this.config,
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
   * @param quality Valor de calidad (0-100)
   * @returns Resultado de la detección con información completa
   */
  public processQuality(quality: number): FingerDetectionResult {
    // Si la calidad es muy baja, reiniciar historial
    if (quality < this.config.RESET_QUALITY_THRESHOLD) {
      if (this.qualityHistory.length > 0) {
        this.qualityHistory = [];
        this.displayQuality = 0;
        this.consecutiveGoodFrames = 0;
      }
    } 
    // Si la calidad supera el umbral mínimo, añadirla al historial
    else if (quality > this.config.MIN_QUALITY_FOR_DETECTION) {
      this.qualityHistory.push(quality);
      if (this.qualityHistory.length > this.historySize) {
        this.qualityHistory.shift();
      }
    } 
    // Si la calidad es muy baja pero no llega al umbral de reset
    else if (this.qualityHistory.length > 0 && quality < this.config.MIN_QUALITY_FOR_DETECTION * 0.5) {
      this.qualityHistory = [];
      this.displayQuality = 0;
      this.consecutiveGoodFrames = 0;
    }
    
    // Calcular calidad a mostrar
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
   * Actualiza el valor de calidad para mostrar
   */
  private updateDisplayQuality(): void {
    // Sin datos, calidad cero
    if (this.qualityHistory.length === 0) {
      this.displayQuality = 0;
      return;
    }
    
    // Frames insuficientes, mostrar calidad parcial
    if (this.qualityHistory.length < this.config.REQUIRED_FINGER_FRAMES) {
      // Mostrar calidad parcial para feedback inmediato
      const lastQuality = this.qualityHistory[this.qualityHistory.length - 1];
      this.displayQuality = Math.max(0, Math.min(25, lastQuality));
      return;
    }
    
    // Calcular calidad ponderada
    let weightedSum = 0;
    let totalWeight = 0;
    
    this.qualityHistory.forEach((q, index) => {
      const weight = Math.pow(1.3, index); // Más peso a valores recientes
      weightedSum += q * weight;
      totalWeight += weight;
    });
    
    const averageQuality = Math.round(weightedSum / totalWeight);
    
    // Verificar consistencia entre valores recientes
    const recentValues = this.qualityHistory.slice(-3);
    const minRecent = Math.min(...recentValues);
    const maxRecent = Math.max(...recentValues);
    const rangeRecent = maxRecent - minRecent;
    
    let finalQuality = averageQuality;
    
    // Penalización mínima para variaciones grandes
    if (rangeRecent > 40 && this.qualityHistory.length < this.historySize) {
      finalQuality = Math.round(finalQuality * 0.9);
    }
    
    // Suavizar cambios para mejor UX con respuesta inmediata
    this.displayQuality = Math.round(
      this.displayQuality + (finalQuality - this.displayQuality) * 0.6
    );
    
    // Actualizar contador de frames buenos consecutivos
    if (finalQuality > 50) {
      this.consecutiveGoodFrames++;
    } else {
      this.consecutiveGoodFrames = 0;
    }
  }
  
  /**
   * Determina si hay un dedo presente con máxima sensibilidad
   */
  public isFingerDetected(): boolean {
    return this.displayQuality > 0 && 
           this.qualityHistory.length >= this.config.REQUIRED_FINGER_FRAMES;
  }
  
  /**
   * Obtiene el color asociado a la calidad de señal
   */
  private getQualityColor(quality: number): string {
    if (quality === 0 || this.qualityHistory.length < this.config.REQUIRED_FINGER_FRAMES) 
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
    if (quality === 0 || this.qualityHistory.length < this.config.REQUIRED_FINGER_FRAMES) 
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
    if (this.displayQuality === 0 || 
        this.qualityHistory.length < this.config.REQUIRED_FINGER_FRAMES) {
      return "Cubra la cámara trasera y el flash con su dedo índice. Presione firmemente pero no muy fuerte.";
    }
    
    // Con dedo pero baja calidad
    if (this.displayQuality < this.config.LOW_QUALITY_THRESHOLD) {
      if (this.deviceType === 'android') {
        return "Presione más firmemente pero sin exceso. Mantenga el dedo estable sobre la cámara trasera.";
      } else if (this.deviceType === 'ios') {
        return "Cubra completamente la cámara trasera. Presione con firmeza moderada y mantenga el dedo quieto.";
      } else {
        return "Asegúrese que su dedo cubra la cámara trasera y manténgalo quieto. Evite presionar demasiado fuerte.";
      }
    }
    
    // Calidad media
    if (this.displayQuality < this.config.QUALITY_THRESHOLD) {
      return "Buen avance. Mantenga esta posición y evite movimientos.";
    }
    
    // Buena calidad
    return "¡Buena señal! Mantenga esta misma presión para óptimos resultados.";
  }
  
  /**
   * Reinicia por completo el detector
   */
  public reset(): void {
    this.qualityHistory = [];
    this.consecutiveGoodFrames = 0;
    this.displayQuality = 0;
    this.lastQualityLevel = '';
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
