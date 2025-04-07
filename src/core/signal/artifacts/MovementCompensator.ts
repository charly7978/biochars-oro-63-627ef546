
/**
 * Compensador de artefactos de movimiento para señales PPG
 * Utiliza técnicas de análisis de variabilidad para detectar y corregir 
 * distorsiones causadas por movimientos durante la captura
 */
export class MovementCompensator {
  // Buffer para análisis de movimiento
  private accelerationHistory: number[] = [];
  private readonly HISTORY_SIZE = 10;
  private readonly MOVEMENT_THRESHOLD = 2.5;
  
  // Estado de detección de movimiento
  private movementDetected: boolean = false;
  private movementIntensity: number = 0;
  private lastStableValues: number[] = [];
  private readonly STABLE_BUFFER_SIZE = 5;
  
  constructor() {
    this.resetHistory();
  }
  
  /**
   * Procesa una señal PPG y la corrige si hay movimiento detectado
   * @param ppgValue Valor PPG actual
   * @param acceleration Valor de aceleración (opcional) del acelerómetro
   * @returns Señal PPG corregida y estado de movimiento
   */
  public processSignal(ppgValue: number, acceleration?: number): {
    correctedValue: number;
    movementDetected: boolean;
    movementIntensity: number;
    isReliable: boolean;
  } {
    // Actualizar detección de movimiento si hay datos del acelerómetro
    if (acceleration !== undefined) {
      this.updateMovementDetection(acceleration);
    } else {
      // Si no hay datos del acelerómetro, usar variaciones en la señal PPG
      this.detectMovementFromSignal(ppgValue);
    }
    
    // Mantener buffer de valores estables
    if (!this.movementDetected) {
      this.lastStableValues.push(ppgValue);
      if (this.lastStableValues.length > this.STABLE_BUFFER_SIZE) {
        this.lastStableValues.shift();
      }
    }
    
    // Aplicar corrección según la intensidad del movimiento
    let correctedValue = ppgValue;
    let isReliable = true;
    
    if (this.movementDetected) {
      if (this.movementIntensity > 0.7) {
        // Movimiento severo - señal no confiable
        isReliable = false;
        
        // Si tenemos valores estables previos, sustituir con la media
        if (this.lastStableValues.length > 0) {
          correctedValue = this.lastStableValues.reduce((sum, val) => sum + val, 0) / 
                          this.lastStableValues.length;
        }
      } else {
        // Movimiento moderado - aplicar corrección proporcional
        const stabilityFactor = 1 - this.movementIntensity;
        
        if (this.lastStableValues.length > 0) {
          const avgStable = this.lastStableValues.reduce((sum, val) => sum + val, 0) / 
                          this.lastStableValues.length;
          
          // Interpolación entre el valor actual y el valor estable promedio
          correctedValue = ppgValue * stabilityFactor + avgStable * (1 - stabilityFactor);
        }
      }
    }
    
    return {
      correctedValue,
      movementDetected: this.movementDetected,
      movementIntensity: this.movementIntensity,
      isReliable
    };
  }
  
  /**
   * Actualiza la detección de movimiento basada en datos del acelerómetro
   * @param acceleration Valor absoluto de aceleración
   */
  private updateMovementDetection(acceleration: number): void {
    // Añadir al historial
    this.accelerationHistory.push(Math.abs(acceleration));
    if (this.accelerationHistory.length > this.HISTORY_SIZE) {
      this.accelerationHistory.shift();
    }
    
    // Calcular estadísticas
    const avg = this.accelerationHistory.reduce((sum, val) => sum + val, 0) / 
               this.accelerationHistory.length;
    
    // Calcular variación respecto a la media
    const variance = this.accelerationHistory.reduce(
      (sum, val) => sum + Math.pow(val - avg, 2), 0
    ) / this.accelerationHistory.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Detectar movimiento si la desviación estándar supera el umbral
    this.movementDetected = stdDev > this.MOVEMENT_THRESHOLD;
    
    // Calcular intensidad del movimiento (normalizada entre 0 y 1)
    this.movementIntensity = Math.min(1, stdDev / (this.MOVEMENT_THRESHOLD * 2));
  }
  
  /**
   * Detecta movimiento basado en la variabilidad de la señal PPG
   * Útil cuando no hay sensores de movimiento disponibles
   * @param ppgValue Valor PPG actual
   */
  private detectMovementFromSignal(ppgValue: number): void {
    // Usar el mismo buffer para almacenar valores PPG
    this.accelerationHistory.push(ppgValue);
    if (this.accelerationHistory.length > this.HISTORY_SIZE) {
      this.accelerationHistory.shift();
    }
    
    if (this.accelerationHistory.length < 4) {
      this.movementDetected = false;
      this.movementIntensity = 0;
      return;
    }
    
    // Calcular derivadas de primer orden (cambios entre muestras consecutivas)
    const derivatives: number[] = [];
    for (let i = 1; i < this.accelerationHistory.length; i++) {
      derivatives.push(this.accelerationHistory[i] - this.accelerationHistory[i-1]);
    }
    
    // Calcular varianza de las derivadas (indicador de movimiento)
    const avg = derivatives.reduce((sum, val) => sum + val, 0) / derivatives.length;
    const variance = derivatives.reduce(
      (sum, val) => sum + Math.pow(val - avg, 2), 0
    ) / derivatives.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Umbral adaptativo basado en la amplitud de la señal
    const signalRange = Math.max(...this.accelerationHistory) - Math.min(...this.accelerationHistory);
    const adaptiveThreshold = Math.max(0.5, signalRange * 0.15);
    
    // Actualizar detección de movimiento
    this.movementDetected = stdDev > adaptiveThreshold;
    this.movementIntensity = Math.min(1, stdDev / (adaptiveThreshold * 2));
  }
  
  /**
   * Reinicia el histórico de movimiento
   */
  public resetHistory(): void {
    this.accelerationHistory = [];
    this.movementDetected = false;
    this.movementIntensity = 0;
    this.lastStableValues = [];
  }
  
  /**
   * Devuelve si el movimiento actual es demasiado intenso para mediciones fiables
   */
  public isMovementTooHigh(): boolean {
    return this.movementDetected && this.movementIntensity > 0.7;
  }
}
