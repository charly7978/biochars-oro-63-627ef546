
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

/**
 * Detector de presencia de dedo avanzado que utiliza propiedades físicas y 
 * análisis de perfusión para lograr una detección robusta con múltiples validaciones
 */
export class FingerDetector {
  // Umbrales clave para detección robusta basados en investigación
  private readonly PERFUSION_THRESHOLD: number = 25;
  private readonly R_G_RATIO_MIN: number = 1.65;
  private readonly RED_MIN_VALUE: number = 150;
  private readonly GREEN_MIN_VALUE: number = 30;
  
  // Estado interno
  private fingerDetected: boolean = false;
  private consecutiveDetections: number = 0;
  private readonly REQUIRED_FRAMES: number = 5;
  private readonly DEVICE_TYPE: string;
  private recentQualityReadings: number[] = [];
  private readonly MAX_QUALITY_READINGS: number = 10;
  
  // Nuevos parámetros para estabilidad
  private readonly STABILITY_THRESHOLD: number = 5;
  private readonly STABILITY_CHANGE_THRESHOLD: number = 15;
  private readonly MAX_PERCENT_CHANGE: number = 10;
  private qualityStability: number = 0;
  private previousQuality: number = 0;
  
  constructor() {
    // Detectar tipo de dispositivo para ajustes específicos
    const userAgent = navigator.userAgent.toLowerCase();
    if (/android/i.test(userAgent)) {
      this.DEVICE_TYPE = "android";
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
      this.DEVICE_TYPE = "ios";
    } else if (/windows/i.test(userAgent)) {
      this.DEVICE_TYPE = "windows";
    } else {
      this.DEVICE_TYPE = "unknown";
    }
    
    console.log("FingerDetector: REIMPLEMENTADO con TRIPLE verificación anti-falsos-positivos", {
      umbralPerfusión: this.PERFUSION_THRESHOLD,
      ratioRojoVerde: this.R_G_RATIO_MIN,
      valorRojoMínimo: this.RED_MIN_VALUE,
      valorVerdeMínimo: this.GREEN_MIN_VALUE,
      framesRequeridos: this.REQUIRED_FRAMES,
      dispositivo: this.DEVICE_TYPE,
      umbralEstabilidad: this.STABILITY_THRESHOLD,
      umbralCambioEstabilidad: this.STABILITY_CHANGE_THRESHOLD,
      cambioPorcentajeMax: this.MAX_PERCENT_CHANGE
    });
  }
  
  /**
   * Procesa la calidad de la señal y determina si se detecta un dedo
   * @param quality Calidad de señal (0-100)
   * @param redValue Valor promedio del canal rojo
   * @param greenValue Valor promedio del canal verde
   * @returns Resultado de detección y calidad
   */
  public processQuality(
    quality: number,
    redValue: number,
    greenValue: number
  ): { isFingerDetected: boolean; quality: number } {
    // Calcular relación rojo/verde (indicador fisiológico clave)
    const redGreenRatio = greenValue > 0 ? redValue / greenValue : 0;
    
    // Actualizar lecturas de calidad recientes
    this.recentQualityReadings.push(quality);
    if (this.recentQualityReadings.length > this.MAX_QUALITY_READINGS) {
      this.recentQualityReadings.shift();
    }
    
    // Calcular estabilidad de calidad (variación entre lecturas consecutivas)
    if (this.previousQuality > 0) {
      const percentChange = Math.abs((quality - this.previousQuality) / this.previousQuality * 100);
      
      // Aumentar estabilidad si cambio es pequeño, disminuir si es grande
      if (percentChange < this.MAX_PERCENT_CHANGE) {
        this.qualityStability = Math.min(100, this.qualityStability + 1);
      } else {
        this.qualityStability = Math.max(0, this.qualityStability - 2);
      }
    }
    
    this.previousQuality = quality;
    
    // Filtrar calidad media para suavizar fluctuaciones
    const filteredQuality = this.calculateFilteredQuality();
    
    // DETECCIÓN DE DEDO: Triple verificación (física, óptica y fisiológica)
    
    // 1. Verificación de calidad de perfusión (principal)
    const qualityCheck = filteredQuality >= this.PERFUSION_THRESHOLD;
    
    // 2. Verificación de propiedades ópticas (secundaria)
    const opticalCheck = redValue >= this.RED_MIN_VALUE && 
                        greenValue >= this.GREEN_MIN_VALUE;
    
    // 3. Verificación de propiedades fisiológicas (terciaria)
    const physiologicalCheck = redGreenRatio >= this.R_G_RATIO_MIN;
    
    // 4. Verificación de estabilidad (anti-falsos positivos)
    const stabilityCheck = this.qualityStability >= this.STABILITY_THRESHOLD;
    
    // Lógica de decisión con mayor peso en propiedades fisiológicas
    // Las propiedades fisiológicas son las más difíciles de falsificar
    let isCurrentlyDetected = false;
    
    if (this.DEVICE_TYPE === "android") {
      // En Android priorizamos ratio R/G y estabilidad
      isCurrentlyDetected = physiologicalCheck && 
                          (qualityCheck || opticalCheck) &&
                          stabilityCheck;
    } else if (this.DEVICE_TYPE === "ios") {
      // En iOS equilibramos todos los factores
      isCurrentlyDetected = (physiologicalCheck && qualityCheck) || 
                          (physiologicalCheck && opticalCheck && stabilityCheck);
    } else {
      // En otros dispositivos (incluido escritorio) usar verificación completa
      isCurrentlyDetected = qualityCheck && 
                          opticalCheck && 
                          physiologicalCheck && 
                          stabilityCheck;
    }
    
    // Lógica de persistencia: requiere N frames consecutivos para confirmar
    // Esto previene falsos positivos por fluctuaciones momentáneas
    if (isCurrentlyDetected) {
      this.consecutiveDetections += 1;
      if (this.consecutiveDetections >= this.REQUIRED_FRAMES && !this.fingerDetected) {
        this.fingerDetected = true;
        console.log("FingerDetector: Dedo detectado con triple verificación", {
          calidad: filteredQuality,
          redValue,
          greenValue,
          ratio: redGreenRatio,
          estabilidad: this.qualityStability
        });
      }
    } else {
      // Requiere N frames consecutivos para confirmar que se quitó el dedo
      // Esto previene falsos negativos por fluctuaciones momentáneas
      this.consecutiveDetections = Math.max(0, this.consecutiveDetections - 1);
      
      if (this.consecutiveDetections === 0 && this.fingerDetected) {
        this.fingerDetected = false;
        console.log("FingerDetector: Dedo removido", {
          calidad: filteredQuality,
          redValue,
          greenValue
        });
      }
    }
    
    return {
      isFingerDetected: this.fingerDetected,
      quality: filteredQuality
    };
  }
  
  /**
   * Calcula una calidad filtrada basada en lecturas recientes
   * Reduce fluctuaciones y proporciona una medida más estable
   */
  private calculateFilteredQuality(): number {
    if (this.recentQualityReadings.length === 0) return 0;
    
    // Si tenemos pocas lecturas, usar promedio simple
    if (this.recentQualityReadings.length < 3) {
      return this.recentQualityReadings.reduce((sum, q) => sum + q, 0) / 
             this.recentQualityReadings.length;
    }
    
    // Ordenar lecturas para encontrar la mediana
    const sortedReadings = [...this.recentQualityReadings].sort((a, b) => a - b);
    const median = sortedReadings[Math.floor(sortedReadings.length / 2)];
    
    // Calcular media sin valores extremos (más robusta)
    const filteredReadings = sortedReadings.filter(
      q => q >= median * 0.7 && q <= median * 1.3
    );
    
    if (filteredReadings.length === 0) return median;
    
    // Aplicar ponderación que favorece valores recientes
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < filteredReadings.length; i++) {
      // Peso aumenta con el índice (valores más recientes tienen más peso)
      const weight = i + 1;
      weightedSum += filteredReadings[i] * weight;
      totalWeight += weight;
    }
    
    return weightedSum / totalWeight;
  }
  
  /**
   * Analiza la variabilidad de las lecturas recientes
   * Útil para determinar si la señal es estable
   */
  private calculateVariability(): number {
    if (this.recentQualityReadings.length < 3) return 100; // Alta variabilidad por defecto
    
    // Calcular diferencias entre lecturas consecutivas
    let totalVariation = 0;
    for (let i = 1; i < this.recentQualityReadings.length; i++) {
      const diff = Math.abs(
        this.recentQualityReadings[i] - this.recentQualityReadings[i - 1]
      );
      totalVariation += diff;
    }
    
    // Normalizar variación
    const avgVariation = totalVariation / (this.recentQualityReadings.length - 1);
    const maxPossibleVariation = 100; // Máxima diferencia posible entre lecturas
    
    // Devolver variabilidad como porcentaje (0-100)
    // 0 = sin variación, 100 = máxima variación
    return Math.min(100, (avgVariation / maxPossibleVariation) * 100);
  }
  
  /**
   * Verifica si hay cambios abruptos en la estabilidad
   * Útil para detectar movimientos o ajustes del dedo
   */
  private hasStabilityChanged(): boolean {
    if (this.recentQualityReadings.length < 5) return false;
    
    const previousStability = this.calculateStabilityScore(
      this.recentQualityReadings.slice(0, -2)
    );
    
    const currentStability = this.calculateStabilityScore(
      this.recentQualityReadings.slice(-5)
    );
    
    return Math.abs(currentStability - previousStability) > this.STABILITY_CHANGE_THRESHOLD;
  }
  
  /**
   * Calcula una puntuación de estabilidad para un conjunto de lecturas
   */
  private calculateStabilityScore(readings: number[]): number {
    if (readings.length < 2) return 0;
    
    // Calcular desviación estándar
    const mean = readings.reduce((sum, r) => sum + r, 0) / readings.length;
    const variance = readings.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / readings.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalizar a una puntuación (menor desviación = mayor estabilidad)
    return Math.max(0, 100 - (stdDev * 2));
  }
  
  /**
   * Reinicia el detector
   */
  public reset(): void {
    this.fingerDetected = false;
    this.consecutiveDetections = 0;
    this.recentQualityReadings = [];
    this.qualityStability = 0;
    this.previousQuality = 0;
  }
}
