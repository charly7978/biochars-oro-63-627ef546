
export class PeakDetector {
  // Constantes para detección más sensible
  private readonly peakWindowSize: number;
  private readonly minPeakThreshold: number;
  private readonly strongPeakThreshold: number;
  private readonly adaptiveThresholdFactor: number;
  private readonly minTimeBetweenBeats: number;
  private readonly maxTimeBetweenBeats: number;
  
  // Variables de estado
  private adaptiveThreshold: number = 0.08; // Reducido para mayor sensibilidad
  private lastPeakTime: number = 0;
  private lastBeatValue: number = 0;
  private stability: number = 0.5;
  private confidence: number = 0.5;
  private lastPeakValues: number[] = [];
  private consecutiveBeats: number = 0;
  private minTimeSinceLastBeat: number;
  private missedBeatCounter: number = 0;
  
  // Umbrales mejorados para detección más sensible
  private readonly MAX_PEAK_VALUES = 10;
  private readonly STABILITY_WINDOW = 5;
  private readonly CONFIDENCE_DECAY = 0.95; // Aumentado para mantener confianza
  private readonly CONFIDENCE_BOOST = 1.8; // Aumentado para respuesta más rápida
  private readonly PEAK_SIMILARITY_THRESHOLD = 0.45; // Reducido para mayor sensibilidad
  private readonly AGGRESSIVE_DETECTION_THRESHOLD = 1; // Valor mínimo

  constructor(
    peakWindowSize: number = 2, 
    minPeakThreshold: number = 0.05, // Reducido significativamente
    strongPeakThreshold: number = 0.12, // Reducido significativamente
    adaptiveThresholdFactor: number = 0.4, // Reducido para mayor sensibilidad
    minTimeBetweenBeats: number = 150, // Reducido significativamente
    maxTimeBetweenBeats: number = 2000 // Sin cambios
  ) {
    this.peakWindowSize = peakWindowSize;
    this.minPeakThreshold = minPeakThreshold;
    this.strongPeakThreshold = strongPeakThreshold;
    this.adaptiveThresholdFactor = adaptiveThresholdFactor;
    this.minTimeBetweenBeats = minTimeBetweenBeats;
    this.maxTimeBetweenBeats = maxTimeBetweenBeats;
    this.minTimeSinceLastBeat = minTimeBetweenBeats;
    
    console.log("PeakDetector: Inicializado con valores ultra sensibles", {
      peakWindowSize,
      minPeakThreshold,
      strongPeakThreshold,
      adaptiveThresholdFactor,
      minTimeBetweenBeats,
      maxTimeBetweenBeats
    });
  }

  // Detección mucho más sensible de señales de latido
  public detectBeat(
    timestamp: number,
    value: number,
    quality: number,
    buffer: number[],
    derivative: number,
    lastHeartBeatTime: number
  ): boolean {
    const timeSinceLastPeak = timestamp - this.lastPeakTime;
    
    // Comprobaciones de tiempo ultra agresivas basadas en la calidad de la señal
    let minTimeRequired = this.minTimeSinceLastBeat;
    if (quality < 70) { // Aumentado para ser más permisivo
      // Para señales de menor calidad, ser mucho más permisivo con el tiempo
      minTimeRequired = Math.max(130, this.minTimeSinceLastBeat * 0.5);
    } else if (this.missedBeatCounter > 0) {
      // Si hemos perdido varios latidos, ser ultra agresivo
      minTimeRequired = Math.max(100, this.minTimeSinceLastBeat * 0.4);
    }
    
    // Ajuste de umbral de detección ultra agresivo basado en la calidad de la señal
    let currentThreshold = this.adaptiveThreshold;
    if (quality < 80) { // Aumentado para ser más permisivo
      // Umbral mucho más bajo para señales de menor calidad
      currentThreshold *= 0.5;
    }
    
    if (this.missedBeatCounter > this.AGGRESSIVE_DETECTION_THRESHOLD) {
      // Umbral extremadamente agresivo para detección después de latidos perdidos
      currentThreshold *= 0.3;
      console.log(`PeakDetector: Usando umbral ultra agresivo ${currentThreshold.toFixed(3)} después de ${this.missedBeatCounter} latidos perdidos`);
    }
    
    // Rechazo temprano para restricciones de tiempo
    if (timeSinceLastPeak < minTimeRequired) {
      return false;
    }
    
    // Algoritmo de detección de picos mejorado con sensibilidad extrema
    const bufferLength = buffer.length;
    let isPeak = false;
    
    if (bufferLength < this.peakWindowSize * 2 + 1) {
      // No hay suficientes datos para la detección
      return false;
    }
    
    // Obtener la ventana deslizante actual
    const windowStart = Math.max(0, bufferLength - this.peakWindowSize * 2 - 1);
    const window = buffer.slice(windowStart);
    
    // Búsqueda de picos ultra agresiva
    if (window.length >= 3) {
      const currentIndex = window.length - 1;
      const current = window[currentIndex];
      
      // Verificar si este punto es un punto de inflexión positivo
      const prevHigherThanThreshold = current > window[currentIndex - 1] + currentThreshold * 0.4;
      const prevLowerThanCurrent = current > window[currentIndex - 1];
      
      // Detectar si tenemos un pico potencial - criterios ultra relajados
      if (prevLowerThanCurrent && prevHigherThanThreshold) {
        // Para el último punto, solo podemos comprobar el anterior
        if (currentIndex === window.length - 1 || current > window[currentIndex + 1]) {
          isPeak = true;
        }
      }
      
      // Detección adicional basada en derivada para picos más difíciles de detectar
      if (!isPeak && derivative > 0.5 && derivative < 4.0) { // Valores ajustados para máxima sensibilidad
        const derivativeChangeSignificant = Math.abs(derivative) > 0.5;
        
        if (derivativeChangeSignificant && current > window[currentIndex - 1]) {
          isPeak = true;
          console.log(`PeakDetector: Pico detectado por análisis de derivada: ${derivative.toFixed(2)}`);
        }
      }
    }
    
    // Solo proceder si detectamos un pico y la calidad es mínimamente aceptable
    if (isPeak && (value > currentThreshold * 0.6 || quality > 20)) { // Reducidos drásticamente
      const timeSinceLastBeat = timestamp - lastHeartBeatTime;
      
      // Comprobación de calidad extremadamente permisiva para la primera detección de latido
      const qualityCheck = lastHeartBeatTime === 0 ? quality > 5 : quality > 10; // Reducido drásticamente
      
      // Comprobar si el pico está dentro de ventanas de tiempo válidas con comprobación extremadamente permisiva
      if ((timeSinceLastBeat >= minTimeRequired || lastHeartBeatTime === 0) && 
          (timeSinceLastBeat <= this.maxTimeBetweenBeats * 1.5 || lastHeartBeatTime === 0) && // Aumentado significativamente
          qualityCheck) {
        
        console.log(`PeakDetector: Pico válido detectado - Valor: ${value.toFixed(3)}, Calidad: ${quality}, TiempoDesdeÚltimoLatido: ${timeSinceLastBeat}ms`);
        
        // Actualizar métrica de estabilidad basada en detección consistente
        if (this.lastPeakValues.length > 0) {
          const prevValue = this.lastPeakValues[this.lastPeakValues.length - 1];
          const similarity = 1 - Math.min(1, Math.abs(value - prevValue) / Math.max(0.01, Math.abs(prevValue)));
          
          // Ajustes de estabilidad más graduales y optimistas
          if (similarity > this.PEAK_SIMILARITY_THRESHOLD) {
            this.stability = Math.min(1.0, this.stability + 0.25);
            this.consecutiveBeats++;
          } else {
            this.stability = Math.max(0.4, this.stability - 0.02);
            this.consecutiveBeats = Math.max(0, this.consecutiveBeats - 1);
          }
        }
        
        // Impulso de confianza mucho más agresivo
        this.confidence = Math.min(1.0, this.confidence * this.CONFIDENCE_BOOST + 0.3);
        
        // Almacenar información del pico
        this.lastPeakTime = timestamp;
        this.lastBeatValue = value;
        this.lastPeakValues.push(value);
        if (this.lastPeakValues.length > this.MAX_PEAK_VALUES) {
          this.lastPeakValues.shift();
        }
        
        // Reiniciar contador de latidos perdidos en detección exitosa
        this.missedBeatCounter = 0;
        
        return true;
      }
    } else if (lastHeartBeatTime > 0) {
      // Latido perdido basado en tiempo - comprobación más agresiva
      const timeSinceLastBeat = timestamp - lastHeartBeatTime;
      const expectedBeatInterval = 60000 / 75; // Asumir frecuencia cardíaca promedio
      
      if (timeSinceLastBeat > expectedBeatInterval * 1.05) { // Reducido significativamente
        this.missedBeatCounter++;
        
        // Reducción de confianza más gradual
        this.confidence = Math.max(0.35, this.confidence * this.CONFIDENCE_DECAY);
        
        if (this.missedBeatCounter % 2 === 0) {
          console.log(`PeakDetector: ${this.missedBeatCounter} latidos consecutivos perdidos, confianza reducida a ${this.confidence.toFixed(2)}`);
        }
      }
    }
    
    return false;
  }

  // Actualización más frecuente para umbral adaptativo
  public updateAdaptiveThreshold(buffer: number[], timestamp: number, debug: boolean = false): void {
    if (buffer.length < 5) return; // Reducido para respuesta más rápida
    
    // Tomar valores recientes para cálculo de umbral
    const recentValues = buffer.slice(-10); // Reducido para respuesta más rápida
    
    // Calcular promedio y desviación estándar
    const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const stdDev = Math.sqrt(
      recentValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recentValues.length
    );
    
    // Umbral más sensible basado en características de la señal
    const newThreshold = Math.max(
      this.minPeakThreshold,
      stdDev * this.adaptiveThresholdFactor
    );
    
    // Adaptación de umbral más rápida (50% antiguo, 50% nuevo)
    this.adaptiveThreshold = this.adaptiveThreshold * 0.5 + newThreshold * 0.5;
    
    // Limitar el umbral a un valor máximo para evitar umbrales excesivos
    this.adaptiveThreshold = Math.min(this.adaptiveThreshold, 0.20);
    
    if (debug) {
      console.log(`PeakDetector: Umbral adaptativo actualizado a ${this.adaptiveThreshold.toFixed(3)}, prom=${avg.toFixed(3)}, desvEst=${stdDev.toFixed(3)}`);
    }
  }

  // Actualizar parámetros de tiempo basados en intervalos detectados
  public setTimingParameters(beatInterval: number): void {
    // Actualizaciones de parámetros de tiempo ultra sensibles
    if (beatInterval > 180 && beatInterval < 2000) { // Rango más permisivo
      // Establecer tiempo mínimo como 45% del último intervalo (ultra agresivo)
      this.minTimeSinceLastBeat = Math.max(
        this.minTimeBetweenBeats,
        Math.round(beatInterval * 0.45) // Reducido significativamente
      );
      
      console.log(`PeakDetector: Tiempo mínimo entre latidos actualizado a ${this.minTimeSinceLastBeat}ms basado en intervalo ${beatInterval}ms`);
    }
  }

  // Reiniciar el detector
  public reset(): void {
    this.adaptiveThreshold = 0.08; // Reducido para mayor sensibilidad inicial
    this.lastPeakTime = 0;
    this.lastBeatValue = 0;
    this.stability = 0.5;
    this.confidence = 0.5;
    this.lastPeakValues = [];
    this.consecutiveBeats = 0;
    this.minTimeSinceLastBeat = this.minTimeBetweenBeats;
    this.missedBeatCounter = 0;
    console.log("PeakDetector: Reinicio completo");
  }
  
  // Getters para estado interno
  public get currentThreshold(): number {
    return this.adaptiveThreshold;
  }
  
  public get lastPeakTimestamp(): number {
    return this.lastPeakTime;
  }
  
  public get confidenceLevel(): number {
    return this.confidence;
  }
  
  public get stabilityLevel(): number {
    return this.stability;
  }
}
