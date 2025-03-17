
/**
 * Amplificador de señales PPG para mejorar la calidad
 */
export class SignalAmplifier {
  private readonly HISTORY_SIZE = 10;
  private readonly GAIN_FACTOR = 1.5;
  private readonly NORMALIZATION_WINDOW = 5;
  
  private history: number[] = [];
  private baselineAvg: number = 0;
  private noiseLevel: number = 0;
  private gainFactor: number = 1.0;
  private lastAmplifiedValue: number = 0;

  /**
   * Procesa un valor y devuelve una versión amplificada y normalizada
   */
  processValue(value: number): { amplifiedValue: number, quality: number } {
    // Actualizar historial para análisis
    this.history.push(value);
    if (this.history.length > this.HISTORY_SIZE) {
      this.history.shift();
    }
    
    // Si no tenemos suficientes datos para procesar
    if (this.history.length < 3) {
      return { amplifiedValue: value, quality: 0.5 };
    }
    
    // Actualizar línea base y estimación de ruido
    this.updateBaselineAndNoise();
    
    // Calcular señal normalizada (centrada alrededor de 0)
    const normalizedValue = value - this.baselineAvg;
    
    // Calcular factor de ganancia adaptativo
    // Aumentamos ganancia cuando hay poco ruido y la disminuimos cuando hay mucho
    this.updateGainFactor();
    
    // Amplificar señal
    const amplifiedValue = normalizedValue * this.gainFactor;
    
    // Aplicar suavizado para evitar cambios bruscos entre frames
    const smoothedValue = this.smoothValue(amplifiedValue);
    this.lastAmplifiedValue = smoothedValue;
    
    // Calcular calidad de señal (0-1)
    // Una buena señal tiene baja proporción ruido/señal
    const signalStrength = Math.abs(normalizedValue);
    const signalToNoise = this.noiseLevel > 0 ? signalStrength / this.noiseLevel : 1;
    const quality = Math.min(1, Math.max(0, 0.5 + signalToNoise * 0.5));
    
    return { 
      amplifiedValue: smoothedValue, 
      quality 
    };
  }

  /**
   * Actualiza la línea base y la estimación de ruido
   */
  private updateBaselineAndNoise(): void {
    // Calcular promedio móvil de los últimos valores
    this.baselineAvg = this.history.reduce((sum, val) => sum + val, 0) / this.history.length;
    
    // Calcular nivel de ruido como la desviación media
    let noiseSum = 0;
    for (const val of this.history) {
      noiseSum += Math.abs(val - this.baselineAvg);
    }
    this.noiseLevel = noiseSum / this.history.length;
  }

  /**
   * Actualiza el factor de ganancia de forma adaptativa
   */
  private updateGainFactor(): void {
    // Si el nivel de ruido es muy bajo, aumentamos la ganancia
    // Si es alto, la reducimos para evitar amplificar el ruido
    const targetGain = Math.max(1.0, this.GAIN_FACTOR / (1 + this.noiseLevel * 10));
    
    // Suavizar cambios en el factor de ganancia
    this.gainFactor = this.gainFactor * 0.8 + targetGain * 0.2;
  }

  /**
   * Aplica suavizado a la señal amplificada
   */
  private smoothValue(value: number): number {
    // Promedio ponderado con el último valor para evitar cambios bruscos
    return this.lastAmplifiedValue * 0.3 + value * 0.7;
  }

  /**
   * Reinicia el amplificador
   */
  reset(): void {
    this.history = [];
    this.baselineAvg = 0;
    this.noiseLevel = 0;
    this.gainFactor = 1.0;
    this.lastAmplifiedValue = 0;
  }
}
