
export class PeakDetector {
  // Constantes para detección
  private readonly peakWindowSize: number;
  private readonly minPeakThreshold: number;
  private readonly strongPeakThreshold: number;
  private readonly adaptiveThresholdFactor: number;
  private readonly minTimeBetweenBeats: number;
  private readonly maxTimeBetweenBeats: number;
  
  // Variables de estado
  private adaptiveThreshold: number = 0.15; // Reducido de 0.2 a 0.15
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
  private readonly CONFIDENCE_DECAY = 0.9;
  private readonly CONFIDENCE_BOOST = 1.3; // Aumentado de 1.2 a 1.3
  private readonly PEAK_SIMILARITY_THRESHOLD = 0.65; // Reducido de 0.7 a 0.65
  private readonly AGGRESSIVE_DETECTION_THRESHOLD = 2; // Reducido de 3 a 2

  constructor(
    peakWindowSize: number = 2, // Reducido de 3 a 2
    minPeakThreshold: number = 0.12, // Reducido de 0.15 a 0.12
    strongPeakThreshold: number = 0.2, // Reducido de 0.25 a 0.2
    adaptiveThresholdFactor: number = 0.5, // Reducido de 0.55 a 0.5
    minTimeBetweenBeats: number = 200, // Reducido de 240 a 200
    maxTimeBetweenBeats: number = 1800 // Aumentado de 1600 a 1800
  ) {
    this.peakWindowSize = peakWindowSize;
    this.minPeakThreshold = minPeakThreshold;
    this.strongPeakThreshold = strongPeakThreshold;
    this.adaptiveThresholdFactor = adaptiveThresholdFactor;
    this.minTimeBetweenBeats = minTimeBetweenBeats;
    this.maxTimeBetweenBeats = maxTimeBetweenBeats;
    this.minTimeSinceLastBeat = minTimeBetweenBeats;
    
    console.log("PeakDetector: Inicializado con valores más sensibles", {
      peakWindowSize,
      minPeakThreshold,
      strongPeakThreshold,
      adaptiveThresholdFactor,
      minTimeBetweenBeats,
      maxTimeBetweenBeats
    });
  }

  // Detección más sensible de señales de latido
  public detectBeat(
    timestamp: number,
    value: number,
    quality: number,
    buffer: number[],
    derivative: number,
    lastHeartBeatTime: number
  ): boolean {
    const timeSinceLastPeak = timestamp - this.lastPeakTime;
    
    // Comprobaciones de tiempo más agresivas basadas en la calidad de la señal
    let minTimeRequired = this.minTimeSinceLastBeat;
    if (quality < 50) { // Aumentado de 40 a 50
      // Para señales de menor calidad, ser más permisivo con el tiempo
      minTimeRequired = Math.max(180, this.minTimeSinceLastBeat * 0.7); // Reducido de 200 a 180 y de 0.8 a 0.7
    } else if (this.missedBeatCounter > 1) { // Reducido de 2 a 1
      // Si hemos perdido varios latidos, ser más agresivo
      minTimeRequired = Math.max(150, this.minTimeSinceLastBeat * 0.6); // Reducido de 180 a 150 y de 0.7 a 0.6
    }
    
    // Ajuste de umbral de detección más agresivo basado en la calidad de la señal
    let currentThreshold = this.adaptiveThreshold;
    if (quality < 60) { // Aumentado de 50 a 60
      // Umbral más bajo para señales de menor calidad
      currentThreshold *= 0.7; // Reducido de 0.8 a 0.7
    }
    
    if (this.missedBeatCounter > this.AGGRESSIVE_DETECTION_THRESHOLD) {
      // Umbral muy agresivo para detección después de latidos perdidos
      currentThreshold *= 0.5; // Reducido de 0.6 a 0.5
      console.log(`PeakDetector: Usando umbral agresivo ${currentThreshold.toFixed(3)} después de ${this.missedBeatCounter} latidos perdidos`);
    }
    
    // Rechazo temprano para restricciones de tiempo
    if (timeSinceLastPeak < minTimeRequired) {
      return false;
    }
    
    // Algoritmo de detección de picos mejorado con mayor sensibilidad
    const bufferLength = buffer.length;
    let isPeak = false;
    
    if (bufferLength < this.peakWindowSize * 2 + 1) {
      // No hay suficientes datos para la detección
      return false;
    }
    
    // Obtener la ventana deslizante actual
    const windowStart = Math.max(0, bufferLength - this.peakWindowSize * 2 - 1);
    const window = buffer.slice(windowStart);
    
    // Búsqueda de picos más agresiva para ventanas pequeñas
    if (window.length >= 3) {
      const currentIndex = window.length - 1;
      const current = window[currentIndex];
      
      // Comprobar si este punto es más alto que el anterior y el siguiente es más bajo (si está disponible)
      const prevHigherThanThreshold = current > window[currentIndex - 1] + currentThreshold * 0.8; // Reducido threshold multiplicador
      const prevLowerThanCurrent = current > window[currentIndex - 1];
      
      // Detectar si tenemos un pico potencial
      if (prevLowerThanCurrent && prevHigherThanThreshold) {
        // Para el último punto, solo podemos comprobar el anterior
        if (currentIndex === window.length - 1 || current > window[currentIndex + 1]) {
          isPeak = true;
        }
      }
    }
    
    // Solo proceder si detectamos un pico y la calidad es aceptable
    if (isPeak && (value > currentThreshold * 0.9 || quality > 35)) { // Reducido de currentThreshold a currentThreshold*0.9 y de 40 a 35
      const timeSinceLastBeat = timestamp - lastHeartBeatTime;
      
      // Comprobación de calidad más permisiva para la primera detección de latido
      const qualityCheck = lastHeartBeatTime === 0 ? quality > 15 : quality > 25; // Reducido de 20 a 15 y de 30 a 25
      
      // Comprobar si el pico está dentro de ventanas de tiempo válidas con comprobación más permisiva
      if ((timeSinceLastBeat >= minTimeRequired || lastHeartBeatTime === 0) && 
          (timeSinceLastBeat <= this.maxTimeBetweenBeats * 1.2 || lastHeartBeatTime === 0) && // Aumentado de 1.1 a 1.2
          qualityCheck) {
        
        console.log(`PeakDetector: Pico válido detectado - Valor: ${value.toFixed(3)}, Calidad: ${quality}, TiempoDesdeÚltimoLatido: ${timeSinceLastBeat}ms`);
        
        // Actualizar métrica de estabilidad basada en detección consistente
        if (this.lastPeakValues.length > 0) {
          const prevValue = this.lastPeakValues[this.lastPeakValues.length - 1];
          const similarity = 1 - Math.min(1, Math.abs(value - prevValue) / Math.max(0.01, Math.abs(prevValue)));
          
          // Ajustes de estabilidad más graduales
          if (similarity > this.PEAK_SIMILARITY_THRESHOLD) {
            this.stability = Math.min(1.0, this.stability + 0.15); // Aumentado de 0.1 a 0.15
            this.consecutiveBeats++;
          } else {
            this.stability = Math.max(0.2, this.stability - 0.03); // Cambiado de 0.1/0.05 a 0.2/0.03
            this.consecutiveBeats = Math.max(0, this.consecutiveBeats - 1);
          }
        }
        
        // Impulso de confianza más agresivo
        this.confidence = Math.min(1.0, this.confidence * this.CONFIDENCE_BOOST + 0.15); // Aumentado de 0.1 a 0.15
        
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
      
      if (timeSinceLastBeat > expectedBeatInterval * 1.2) { // Reducido de 1.3 a 1.2
        this.missedBeatCounter++;
        
        // Reducción de confianza más agresiva
        this.confidence = Math.max(0.25, this.confidence * this.CONFIDENCE_DECAY); // Aumentado de 0.2 a 0.25
        
        if (this.missedBeatCounter % 2 === 0) { // Reducido de 3 a 2
          console.log(`PeakDetector: ${this.missedBeatCounter} latidos consecutivos perdidos, confianza reducida a ${this.confidence.toFixed(2)}`);
        }
      }
    }
    
    return false;
  }

  // Actualización más frecuente para umbral adaptativo
  public updateAdaptiveThreshold(buffer: number[], timestamp: number, debug: boolean = false): void {
    if (buffer.length < 8) return; // Reducido de 10 a 8
    
    // Tomar valores recientes para cálculo de umbral
    const recentValues = buffer.slice(-15); // Reducido de 20 a 15
    
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
    
    // Adaptación de umbral más rápida (70% antiguo, 30% nuevo)
    this.adaptiveThreshold = this.adaptiveThreshold * 0.7 + newThreshold * 0.3; // Cambiado de 0.8/0.2 a 0.7/0.3
    
    if (debug) {
      console.log(`PeakDetector: Umbral adaptativo actualizado a ${this.adaptiveThreshold.toFixed(3)}, prom=${avg.toFixed(3)}, desvEst=${stdDev.toFixed(3)}`);
    }
  }

  // Actualizar parámetros de tiempo basados en intervalos detectados
  public setTimingParameters(beatInterval: number): void {
    // Actualizaciones de parámetros de tiempo más sensibles
    if (beatInterval > 250 && beatInterval < 1800) { // Cambiado de 300/1500 a 250/1800
      // Establecer tiempo mínimo como 65% del último intervalo (más agresivo)
      this.minTimeSinceLastBeat = Math.max(
        this.minTimeBetweenBeats,
        Math.round(beatInterval * 0.65) // Reducido de 0.75 a 0.65
      );
      
      console.log(`PeakDetector: Tiempo mínimo entre latidos actualizado a ${this.minTimeSinceLastBeat}ms basado en intervalo ${beatInterval}ms`);
    }
  }

  // Reiniciar el detector
  public reset(): void {
    this.adaptiveThreshold = 0.15; // Reducido de 0.2 a 0.15
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
