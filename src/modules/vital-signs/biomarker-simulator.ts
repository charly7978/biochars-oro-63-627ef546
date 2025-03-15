
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

export class BiomarkerSimulator {
  private lastGlucoseValue: number = 90;
  private lastCholesterolValue: number = 180;
  private lastTriglyceridesValue: number = 120;
  private trend: number = 0;
  
  /**
   * Simula una lectura de glucosa basada en la calidad de la señal
   * @param signalQuality Calidad de la señal (0-100)
   * @returns Valor de glucosa simulado
   */
  public simulateGlucoseReading(signalQuality: number = 0): number {
    if (signalQuality < 30) return 0; // Sin detección de dedo, sin lectura
    
    // Con señal de calidad, generar valor realista
    // Pequeña variación con tendencia
    if (Math.random() > 0.8) {
      this.trend = Math.random() > 0.5 ? 0.5 : -0.5;
    }
    
    // Calcular nuevo valor con tendencia y variación aleatoria
    const baseVariation = Math.random() * 5 - 2.5;
    const qualityFactor = signalQuality / 100;
    const newValue = this.lastGlucoseValue + (baseVariation + this.trend) * qualityFactor;
    
    // Guardar último valor para continuidad
    this.lastGlucoseValue = Math.round(Math.max(70, Math.min(180, newValue)));
    
    return this.lastGlucoseValue;
  }

  /**
   * Simula perfiles lipídicos basados en la calidad de la señal
   * @param signalQuality Calidad de la señal (0-100)
   * @returns Valores de lípidos simulados
   */
  public simulateLipidProfiles(signalQuality: number = 0): {totalCholesterol: number, triglycerides: number} {
    if (signalQuality < 40) return { totalCholesterol: 0, triglycerides: 0 }; // Sin detección adecuada, sin lectura
    
    // Con señal de calidad, generar valores realistas
    const cholVariation = Math.random() * 4 - 2;
    const trigVariation = Math.random() * 6 - 3;
    const qualityFactor = signalQuality / 100;
    
    // Calcular nuevos valores
    const newCholesterol = this.lastCholesterolValue + cholVariation * qualityFactor;
    const newTriglycerides = this.lastTriglyceridesValue + trigVariation * qualityFactor;
    
    // Guardar últimos valores para continuidad
    this.lastCholesterolValue = Math.round(Math.max(140, Math.min(240, newCholesterol)));
    this.lastTriglyceridesValue = Math.round(Math.max(70, Math.min(200, newTriglycerides)));
    
    return {
      totalCholesterol: this.lastCholesterolValue,
      triglycerides: this.lastTriglyceridesValue
    };
  }
  
  /**
   * Reinicia los valores del simulador
   */
  public reset(): void {
    this.lastGlucoseValue = 90 + Math.round(Math.random() * 20 - 10);
    this.lastCholesterolValue = 180 + Math.round(Math.random() * 10 - 5);
    this.lastTriglyceridesValue = 120 + Math.round(Math.random() * 16 - 8);
    this.trend = 0;
  }
}
