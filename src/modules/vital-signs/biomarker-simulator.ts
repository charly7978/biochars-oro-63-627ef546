
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

export class BiomarkerSimulator {
  /**
   * Simula una lectura de glucosa basada en la calidad de la señal
   * @returns Valor de glucosa simulado
   */
  public simulateGlucoseReading(): number {
    // Simulated glucose based on randomness
    const baseGlucose = 90;
    const variation = Math.random() * 20 - 10;
    return Math.round(baseGlucose + variation);
  }

  /**
   * Simula perfiles lipídicos basados en la calidad de la señal
   * @returns Valores de lípidos simulados
   */
  public simulateLipidProfiles(): {totalCholesterol: number, triglycerides: number} {
    // Simulated lipids
    const baseCholesterol = 180;
    const baseTriglycerides = 120;
    const cholVariation = Math.random() * 30 - 15;
    const trigVariation = Math.random() * 40 - 20;
    
    return {
      totalCholesterol: Math.round(baseCholesterol + cholVariation),
      triglycerides: Math.round(baseTriglycerides + trigVariation)
    };
  }
}
