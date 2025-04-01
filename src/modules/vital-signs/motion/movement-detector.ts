
/**
 * Detector de movimiento basado en datos del acelerómetro
 * Permite identificar patrones de movimiento que pueden afectar a las mediciones
 */
export class MovementDetector {
  // Configuración
  private readonly MOVEMENT_THRESHOLD = 1.2; // Umbral para movimiento significativo
  private readonly STABLE_SAMPLES_REQUIRED = 4; // Muestras estables requeridas
  
  // Estado
  private recentAccelData: {x: number, y: number, z: number}[] = [];
  private stableCount: number = 0;
  private lastVariance: number = 0;
  private lastMovementTime: number = 0;
  private movementDetected: boolean = false;
  
  /**
   * Procesa nuevos datos del acelerómetro
   */
  public processAccelerometerData(data: {x: number, y: number, z: number}): boolean {
    // Almacenar datos recientes
    this.recentAccelData.push(data);
    if (this.recentAccelData.length > 10) {
      this.recentAccelData.shift();
    }
    
    // Calcular varianza para detectar movimiento
    const variance = this.calculateAccelerometerVariance();
    this.lastVariance = variance;
    
    // Detectar movimiento basado en la varianza
    const now = Date.now();
    const isSignificantMovement = variance > this.MOVEMENT_THRESHOLD;
    
    if (isSignificantMovement) {
      this.stableCount = 0;
      this.lastMovementTime = now;
      this.movementDetected = true;
    } else {
      // Incrementar contador de estabilidad
      this.stableCount++;
      
      // Considerar estable después de varias muestras sin movimiento
      if (this.stableCount >= this.STABLE_SAMPLES_REQUIRED) {
        // Mantener el estado de movimiento por un tiempo mínimo para evitar falsos negativos
        this.movementDetected = (now - this.lastMovementTime) < 800;
      }
    }
    
    return this.movementDetected;
  }
  
  /**
   * Verifica si hay movimiento significativo
   */
  public hasSignificantMovement(): boolean {
    return this.movementDetected;
  }
  
  /**
   * Obtiene la intensidad del movimiento reciente (0-1)
   */
  public getMovementIntensity(): number {
    if (this.recentAccelData.length < 3) return 0;
    
    const maxIntensity = 3.0; // Valor máximo de varianza para escalar
    return Math.min(1.0, this.lastVariance / maxIntensity);
  }
  
  /**
   * Calcula la varianza de los datos del acelerómetro
   */
  private calculateAccelerometerVariance(): number {
    if (this.recentAccelData.length < 3) return 0;
    
    // Calcular varianza para cada eje
    const xValues = this.recentAccelData.map(data => data.x);
    const yValues = this.recentAccelData.map(data => data.y);
    const zValues = this.recentAccelData.map(data => data.z);
    
    const xVariance = this.calculateVariance(xValues);
    const yVariance = this.calculateVariance(yValues);
    const zVariance = this.calculateVariance(zValues);
    
    // Varianza combinada
    return Math.sqrt(xVariance * xVariance + yVariance * yVariance + zVariance * zVariance);
  }
  
  /**
   * Calcula la varianza de un array de valores
   */
  private calculateVariance(values: number[]): number {
    if (values.length <= 1) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * Reinicia el detector
   */
  public reset(): void {
    this.recentAccelData = [];
    this.stableCount = 0;
    this.lastVariance = 0;
    this.lastMovementTime = 0;
    this.movementDetected = false;
  }
}
