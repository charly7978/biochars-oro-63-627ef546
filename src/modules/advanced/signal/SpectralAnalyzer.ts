
/**
 * Implementación de un analizador espectral adaptativo para verificar
 * la calidad de la señal PPG en tiempo real y detectar artefactos.
 * 
 * NOTA IMPORTANTE: Este módulo implementa técnicas avanzadas manteniendo
 * compatibilidad con las interfaces principales en index.tsx y PPGSignalMeter.tsx.
 */

export class SpectralAnalyzer {
  // Configuración del análisis espectral
  private readonly WINDOW_SIZE = 64;  // Tamaño de ventana para FFT (potencia de 2)
  private readonly SAMPLING_RATE = 30; // Frecuencia de muestreo estimada (Hz)
  
  // Parámetros fisiológicos para análisis
  private readonly HR_MIN_FREQ = 0.5;  // Frecuencia cardíaca mínima (Hz) ~ 30 BPM
  private readonly HR_MAX_FREQ = 3.0;  // Frecuencia cardíaca máxima (Hz) ~ 180 BPM
  private readonly RESP_FREQ_RANGE = [0.15, 0.4]; // Rango de frecuencia respiratoria (Hz)
  
  // Umbrales de calidad de señal
  private readonly MIN_SNR = 3.0;  // Relación señal-ruido mínima aceptable
  private readonly MIN_POWER_RATIO = 0.15; // Ratio mínimo de potencia en banda cardíaca
  
  // Estado
  private lastSpectrum: number[] = [];
  private dominantFrequency: number = 0;
  private signalToNoiseRatio: number = 0;
  private isLowResolution: boolean = false;
  
  constructor() {
    console.log('Analizador espectral adaptativo inicializado');
  }
  
  /**
   * Analiza la calidad de la señal PPG mediante análisis espectral
   * @returns Un valor entre 0 y 1 indicando la calidad (1 = máxima calidad)
   */
  public analyzeQuality(values: number[]): number {
    // Verificar si tenemos suficientes muestras
    if (values.length < this.WINDOW_SIZE) {
      return 0;
    }
    
    // Tomar las muestras más recientes
    const recentValues = values.slice(-this.WINDOW_SIZE);
    
    // Aplicar ventana de Hamming
    const windowedValues = this.applyWindow(recentValues);
    
    // Calcular espectro de potencia
    const spectrum = this.isLowResolution ? 
                      this.calculateSimplifiedSpectrum(windowedValues) : 
                      this.calculatePowerSpectrum(windowedValues);
    
    this.lastSpectrum = spectrum;
    
    // Identificar componentes fisiológicas
    const { 
      cardiacPower, 
      respiratoryPower,
      noisePower,
      dominantFreq
    } = this.identifyPhysiologicalComponents(spectrum);
    
    this.dominantFrequency = dominantFreq;
    
    // Calcular SNR (relación señal-ruido)
    const totalPower = spectrum.reduce((sum, v) => sum + v, 0);
    const signalPower = cardiacPower + respiratoryPower;
    
    this.signalToNoiseRatio = noisePower > 0 ? signalPower / noisePower : 0;
    
    // Calcular métricas de calidad
    const powerRatio = totalPower > 0 ? cardiacPower / totalPower : 0;
    const snrScore = Math.min(1, this.signalToNoiseRatio / this.MIN_SNR);
    const powerScore = Math.min(1, powerRatio / this.MIN_POWER_RATIO);
    
    // Estimar coherencia espectral
    const spectralCoherence = this.calculateSpectralCoherence(spectrum);
    
    // Combinar métricas ponderadas para calidad final
    const qualityScore = (
      snrScore * 0.4 + 
      powerScore * 0.4 + 
      spectralCoherence * 0.2
    );
    
    return Math.max(0, Math.min(1, qualityScore));
  }
  
  /**
   * Detecta artefactos de presión en la señal PPG
   * @returns Un valor entre 0 y 1 indicando el nivel de artefacto (0 = sin artefactos)
   */
  public detectPressureArtifacts(values: number[]): number {
    if (values.length < 30) {
      return 0;
    }
    
    // Calcular características para detectar artefactos de presión
    
    // 1. Asimetría de la forma de onda (los artefactos de presión generan asimetría)
    const recentValues = values.slice(-30);
    const mean = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
    
    let skewness = 0;
    let sumCubed = 0;
    
    for (let i = 0; i < recentValues.length; i++) {
      const diff = recentValues[i] - mean;
      sumCubed += Math.pow(diff, 3);
    }
    
    // Calcular desviación estándar
    const variance = recentValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev > 0) {
      // Calcular asimetría (skewness)
      skewness = (sumCubed / recentValues.length) / Math.pow(stdDev, 3);
    }
    
    // 2. Detección de componentes de alta frecuencia anómalas
    const hasHighFrequencyComponents = this.detectHighFrequencyComponents(values);
    
    // 3. Cambios abruptos en la amplitud
    const amplitudeJumps = this.detectAmplitudeJumps(values);
    
    // Combinar métricas para detección de artefactos de presión
    const pressureArtifactLevel = Math.min(1, Math.max(0,
      Math.abs(skewness) * 0.3 +
      hasHighFrequencyComponents * 0.4 +
      amplitudeJumps * 0.3
    ));
    
    return pressureArtifactLevel;
  }
  
  /**
   * Detecta componentes de alta frecuencia que podrían indicar artefactos
   */
  private detectHighFrequencyComponents(values: number[]): number {
    if (values.length < this.WINDOW_SIZE) {
      return 0;
    }
    
    // Para análisis simplificado calculamos ratio de cambios rápidos
    const recentValues = values.slice(-this.WINDOW_SIZE);
    let fastChangesCount = 0;
    
    for (let i = 2; i < recentValues.length; i++) {
      const prevDiff = recentValues[i-1] - recentValues[i-2];
      const currDiff = recentValues[i] - recentValues[i-1];
      
      // Detectar cambios de dirección rápidos (alta frecuencia)
      if (prevDiff * currDiff < 0 && 
          (Math.abs(prevDiff) > 0.01 || Math.abs(currDiff) > 0.01)) {
        fastChangesCount++;
      }
    }
    
    // Normalizar conteo
    const maxChanges = recentValues.length / 2;
    const highFreqRatio = fastChangesCount / maxChanges;
    
    // Sólo valores por encima de un umbral fisiológico se consideran artefactos
    return Math.max(0, highFreqRatio - 0.35);
  }
  
  /**
   * Detecta cambios abruptos en la amplitud que indican artefactos de presión
   */
  private detectAmplitudeJumps(values: number[]): number {
    if (values.length < 15) {
      return 0;
    }
    
    const recentValues = values.slice(-15);
    let jumpCount = 0;
    
    // Calcular amplitud típica
    const diffs = [];
    for (let i = 1; i < recentValues.length; i++) {
      diffs.push(Math.abs(recentValues[i] - recentValues[i-1]));
    }
    
    // Ordenar diferencias y calcular mediana
    diffs.sort((a, b) => a - b);
    const medianDiff = diffs[Math.floor(diffs.length / 2)];
    
    // Detectar saltos que son significativamente mayores que la mediana
    for (let i = 1; i < recentValues.length; i++) {
      const diff = Math.abs(recentValues[i] - recentValues[i-1]);
      if (diff > medianDiff * 3) {
        jumpCount++;
      }
    }
    
    // Normalizar
    return Math.min(1, jumpCount / 5);
  }
  
  /**
   * Aplica una ventana de Hamming a los valores para reducir leakage espectral
   */
  private applyWindow(values: number[]): number[] {
    return values.map((v, i) => {
      // Función ventana de Hamming: 0.54 - 0.46 * cos(2πn/(N-1))
      const windowFactor = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (values.length - 1));
      return v * windowFactor;
    });
  }
  
  /**
   * Calcula el espectro de potencia utilizando FFT simplificada
   */
  private calculatePowerSpectrum(values: number[]): number[] {
    // Implementamos una versión simplificada de análisis espectral
    // para dispositivos con recursos limitados
    
    // En una implementación completa se usaría FFT real
    const spectrum: number[] = [];
    const n = values.length;
    
    // Calcular componentes espectrales para un conjunto de frecuencias
    for (let freq = 0; freq < n / 2; freq++) {
      let re = 0;
      let im = 0;
      
      // Calcular componentes de Fourier
      for (let t = 0; t < n; t++) {
        const angle = 2 * Math.PI * freq * t / n;
        re += values[t] * Math.cos(angle);
        im -= values[t] * Math.sin(angle);
      }
      
      // Calcular potencia (magnitud al cuadrado)
      const power = (re * re + im * im) / (n * n);
      spectrum.push(power);
    }
    
    return spectrum;
  }
  
  /**
   * Implementación simplificada de análisis espectral para dispositivos limitados
   */
  private calculateSimplifiedSpectrum(values: number[]): number[] {
    // Versión aún más simplificada para dispositivos muy limitados
    const n = values.length;
    const spectrum: number[] = [];
    
    // Usar sólo un subconjunto de frecuencias relevantes para PPG
    const freqCount = 16; // Menor resolución
    
    for (let freq = 0; freq < freqCount; freq++) {
      // Mapear índice a frecuencia fisiológicamente relevante (0.5-3.5Hz)
      const physFreq = 0.5 + (freq * 3.0 / freqCount);
      
      let re = 0;
      let im = 0;
      
      // Calcular fase para esta frecuencia
      const samplesPerCycle = this.SAMPLING_RATE / physFreq;
      
      // Calcular componentes de Fourier para esta frecuencia
      for (let t = 0; t < n; t++) {
        const angle = 2 * Math.PI * t / samplesPerCycle;
        re += values[t] * Math.cos(angle);
        im -= values[t] * Math.sin(angle);
      }
      
      // Potencia para esta frecuencia
      const power = (re * re + im * im) / (n * n);
      spectrum.push(power);
    }
    
    return spectrum;
  }
  
  /**
   * Identifica componentes fisiológicas en el espectro de potencia
   */
  private identifyPhysiologicalComponents(spectrum: number[]): {
    cardiacPower: number;
    respiratoryPower: number;
    noisePower: number;
    dominantFreq: number;
  } {
    // Frecuencias en Hz para cada bin espectral
    const freqResolution = this.SAMPLING_RATE / (2 * this.WINDOW_SIZE);
    
    let cardiacPower = 0;
    let respiratoryPower = 0;
    let noisePower = 0;
    
    let maxPower = 0;
    let dominantFreqBin = 0;
    
    // Analizar cada componente espectral
    for (let i = 0; i < spectrum.length; i++) {
      // Convertir índice a frecuencia
      const freq = i * freqResolution;
      
      // Clasificar en componentes fisiológicas
      if (freq >= this.HR_MIN_FREQ && freq <= this.HR_MAX_FREQ) {
        // Componente cardíaca
        cardiacPower += spectrum[i];
        
        // Actualizar frecuencia dominante
        if (spectrum[i] > maxPower) {
          maxPower = spectrum[i];
          dominantFreqBin = i;
        }
      } else if (freq >= this.RESP_FREQ_RANGE[0] && freq <= this.RESP_FREQ_RANGE[1]) {
        // Componente respiratoria
        respiratoryPower += spectrum[i];
      } else {
        // Ruido (fuera de bandas fisiológicas)
        noisePower += spectrum[i];
      }
    }
    
    // Convertir bin dominante a frecuencia
    const dominantFreq = dominantFreqBin * freqResolution;
    
    return {
      cardiacPower,
      respiratoryPower,
      noisePower,
      dominantFreq
    };
  }
  
  /**
   * Calcula la coherencia espectral como medida de calidad
   */
  private calculateSpectralCoherence(spectrum: number[]): number {
    // Una señal PPG de buena calidad tiene un espectro con un pico dominante claro
    if (spectrum.length < 3) return 0;
    
    // Encontrar pico máximo
    let maxPower = Math.max(...spectrum);
    let maxIndex = spectrum.indexOf(maxPower);
    
    if (maxPower === 0) return 0;
    
    // Calcular promedio de potencia
    const avgPower = spectrum.reduce((sum, v) => sum + v, 0) / spectrum.length;
    
    // Calcular relación pico-promedio
    const peakToAverage = maxPower / (avgPower || 1);
    
    // Calcular caída desde el pico (pendiente)
    let leftSlope = 0;
    let rightSlope = 0;
    
    if (maxIndex > 0) {
      leftSlope = maxPower - spectrum[maxIndex - 1];
    }
    
    if (maxIndex < spectrum.length - 1) {
      rightSlope = maxPower - spectrum[maxIndex + 1];
    }
    
    // Un buen pico tiene pendientes pronunciadas
    const slopeScore = (leftSlope + rightSlope) / (2 * maxPower);
    
    // Combinar métricas
    return Math.min(1, (peakToAverage / 5) * 0.7 + slopeScore * 0.3);
  }
  
  /**
   * Activa el modo de baja resolución para dispositivos con recursos limitados
   */
  public setLowResolution(enabled: boolean): void {
    this.isLowResolution = enabled;
  }
  
  /**
   * Reinicia el estado del analizador
   */
  public reset(): void {
    this.lastSpectrum = [];
    this.dominantFrequency = 0;
    this.signalToNoiseRatio = 0;
  }
}
