
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Ajustador de factores ambientales
 * Tiene en cuenta condiciones ambientales y características del dispositivo
 */

/**
 * Condiciones ambientales
 */
export interface EnvironmentalConditions {
  lightLevel?: number;        // 0-100 nivel de luz
  temperature?: number;       // temperatura en celsius
  deviceModel?: string;       // modelo del dispositivo
  screenBrightness?: number;  // 0-100 brillo de pantalla
  batteryLevel?: number;      // 0-100 nivel de batería
  motionLevel?: number;       // 0-100 nivel de movimiento
  lastUpdated?: number;       // timestamp de la última actualización
}

/**
 * Factores de ajuste
 */
export interface AdjustmentFactors {
  signalAmplification: number;
  noiseReduction: number;
  signalOffset: number;
  confidence: number;
}

/**
 * Ajustador de factores ambientales
 * Calcula factores de ajuste basado en condiciones del entorno
 */
export class EnvironmentalAdjuster {
  private static instance: EnvironmentalAdjuster;
  private currentConditions: EnvironmentalConditions;
  private currentFactors: AdjustmentFactors;
  private isInitialized: boolean = false;
  
  /**
   * Constructor privado para singleton
   */
  private constructor() {
    // Inicializar con valores por defecto
    this.currentConditions = {
      lightLevel: 50,        // Nivel de luz media
      temperature: 22,       // Temperatura ambiente normal
      deviceModel: "unknown",
      screenBrightness: 75,  // Brillo normal
      batteryLevel: 100,     // Batería completa
      motionLevel: 0,        // Sin movimiento
      lastUpdated: Date.now()
    };
    
    // Factores neutrales
    this.currentFactors = {
      signalAmplification: 1.0,
      noiseReduction: 1.0,
      signalOffset: 0.0,
      confidence: 1.0
    };
    
    this.isInitialized = true;
    console.log("EnvironmentalAdjuster: Inicializado con valores por defecto");
  }
  
  /**
   * Obtener instancia única
   */
  public static getInstance(): EnvironmentalAdjuster {
    if (!EnvironmentalAdjuster.instance) {
      EnvironmentalAdjuster.instance = new EnvironmentalAdjuster();
    }
    return EnvironmentalAdjuster.instance;
  }
  
  /**
   * Actualizar condiciones ambientales
   * @param conditions Nuevas condiciones
   */
  public updateConditions(conditions: Partial<EnvironmentalConditions>): void {
    // Actualizar sólo los valores proporcionados
    this.currentConditions = {
      ...this.currentConditions,
      ...conditions,
      lastUpdated: Date.now()
    };
    
    // Recalcular factores de ajuste
    this.calculateAdjustmentFactors();
    
    console.log("EnvironmentalAdjuster: Condiciones actualizadas", this.currentConditions);
  }
  
  /**
   * Calcular factores de ajuste basados en condiciones actuales
   */
  private calculateAdjustmentFactors(): void {
    const conditions = this.currentConditions;
    let amplification = 1.0;
    let noiseReduction = 1.0;
    let signalOffset = 0.0;
    let confidence = 1.0;
    
    // Ajuste por nivel de luz
    if (conditions.lightLevel !== undefined) {
      // Luces muy bajas necesitan mayor amplificación
      if (conditions.lightLevel < 20) {
        amplification *= 1.4;
        noiseReduction *= 1.2;  // Más filtrado de ruido
        confidence *= 0.8;      // Menor confianza
      } 
      // Luces muy altas pueden saturar la señal
      else if (conditions.lightLevel > 80) {
        amplification *= 0.8;   // Menor amplificación
        signalOffset -= 0.05;   // Ajuste negativo para compensar saturación
        confidence *= 0.9;      // Ligera reducción de confianza
      }
    }
    
    // Ajuste por temperatura
    if (conditions.temperature !== undefined) {
      // Temperaturas fuera del rango óptimo (18-26°C)
      if (conditions.temperature < 18 || conditions.temperature > 26) {
        const tempDeviation = Math.min(Math.abs(conditions.temperature - 22) / 10, 1);
        amplification *= (1 + tempDeviation * 0.2);
        confidence *= (1 - tempDeviation * 0.2);
      }
    }
    
    // Ajuste por brillo de pantalla
    if (conditions.screenBrightness !== undefined) {
      // Brillo alto puede interferir con la cámara
      if (conditions.screenBrightness > 90) {
        noiseReduction *= 1.2;
        signalOffset += 0.02;
        confidence *= 0.95;
      }
    }
    
    // Ajuste por nivel de batería
    if (conditions.batteryLevel !== undefined) {
      // Batería baja puede afectar rendimiento de la cámara
      if (conditions.batteryLevel < 20) {
        noiseReduction *= 1.1;
        confidence *= 0.9;
      }
    }
    
    // Ajuste por nivel de movimiento
    if (conditions.motionLevel !== undefined) {
      // Movimiento alto genera ruido
      if (conditions.motionLevel > 30) {
        const motionFactor = Math.min(conditions.motionLevel / 100, 1);
        noiseReduction *= (1 + motionFactor * 0.5);
        confidence *= (1 - motionFactor * 0.4);
      }
    }
    
    // Ajuste específico por modelo de dispositivo
    if (conditions.deviceModel) {
      // Ajustes específicos para ciertos dispositivos
      // Sólo ejemplos, se deberían calibrar con datos reales
      switch (conditions.deviceModel.toLowerCase()) {
        case "iphone":
          amplification *= 0.95;
          break;
        case "samsung":
          amplification *= 1.05;
          break;
        case "pixel":
          amplification *= 0.9;
          noiseReduction *= 1.1;
          break;
        case "xiaomi":
          amplification *= 1.1;
          break;
        // Por defecto no hay ajuste
      }
    }
    
    // Guardar factores calculados
    this.currentFactors = {
      signalAmplification: amplification,
      noiseReduction: noiseReduction,
      signalOffset: signalOffset,
      confidence: confidence
    };
    
    console.log("EnvironmentalAdjuster: Factores calculados", this.currentFactors);
  }
  
  /**
   * Obtener factores de ajuste actuales
   */
  public getAdjustmentFactors(): AdjustmentFactors {
    return { ...this.currentFactors };
  }
  
  /**
   * Obtener condiciones ambientales actuales
   */
  public getCurrentConditions(): EnvironmentalConditions {
    return { ...this.currentConditions };
  }
  
  /**
   * Aplicar ajustes a un valor de señal
   * @param value Valor original
   * @returns Valor ajustado
   */
  public applySignalAdjustment(value: number): number {
    if (!this.isInitialized || value === 0) {
      return value;
    }
    
    // Aplicar ajustes en secuencia
    let adjustedValue = value;
    
    // Aplicar offset
    adjustedValue += this.currentFactors.signalOffset;
    
    // Aplicar amplificación
    adjustedValue *= this.currentFactors.signalAmplification;
    
    // No aplicamos el factor de ruido directamente aquí
    // ya que este debería afectar a los filtros, no al valor
    
    return adjustedValue;
  }
  
  /**
   * Estimar condiciones ambientales automáticamente a partir de la señal
   * @param recentValues Array con valores recientes de la señal
   */
  public estimateConditions(recentValues: number[]): void {
    if (recentValues.length < 10) {
      return; // Necesitamos suficientes valores
    }
    
    // Calcular métricas de la señal
    const avg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const maxVal = Math.max(...recentValues);
    const minVal = Math.min(...recentValues);
    const range = maxVal - minVal;
    
    // Calcular varianza (medida del ruido)
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    
    // Estimar nivel de luz basado en la amplitud de la señal
    const estimatedLightLevel = range > 0.05 ? Math.min(100, range * 200) : 10;
    
    // Estimar nivel de movimiento basado en la varianza
    const estimatedMotion = Math.min(100, stdDev * 500);
    
    // Actualizar condiciones estimadas
    this.updateConditions({
      lightLevel: estimatedLightLevel,
      motionLevel: estimatedMotion
    });
  }
  
  /**
   * Restablecer a valores por defecto
   */
  public reset(): void {
    // Restablecer a condiciones por defecto
    this.currentConditions = {
      lightLevel: 50,
      temperature: 22,
      deviceModel: "unknown",
      screenBrightness: 75,
      batteryLevel: 100,
      motionLevel: 0,
      lastUpdated: Date.now()
    };
    
    // Restablecer factores a valores neutrales
    this.currentFactors = {
      signalAmplification: 1.0,
      noiseReduction: 1.0,
      signalOffset: 0.0,
      confidence: 1.0
    };
    
    console.log("EnvironmentalAdjuster: Valores restablecidos a predeterminados");
  }
}
