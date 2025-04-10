
import { ProcessorConfig } from '../config/ProcessorConfig';
import { KalmanFilter } from './filters/KalmanFilter';
import { WaveletDenoiser } from './filters/WaveletDenoiser';

/**
 * Interfaz para canales de señal optimizados
 */
export interface OptimizedChannel {
  name: string;
  values: number[];
  quality: number;
  metadata: {
    gain: number;
    snr: number;
    periodicityScore: number;
    dominantFrequency: number;
    amplitudeNormalized: number;
    optimizationLevel: number;
  };
}

/**
 * Optimizador Adaptativo Multicanal
 * 
 * Sistema avanzado de procesamiento que:
 * 1. Divide la señal PPG en canales específicos para cada tipo de análisis
 * 2. Aplica algoritmos de limpieza y optimización específicos para cada canal
 * 3. Proporciona feedback bidireccional con los algoritmos de medición
 * 4. Ajusta dinámicamente parámetros basados en resultados y calidad
 */
export class AdaptiveOptimizer {
  // Canales de señal especializados
  private channels: Map<string, OptimizedChannel> = new Map();
  
  // Filtros específicos para cada canal
  private filters: Map<string, {
    kalman: KalmanFilter,
    wavelet: WaveletDenoiser,
  }> = new Map();
  
  // Buffer de señal principal
  private rawBuffer: number[] = [];
  private readonly MAX_BUFFER_SIZE = 600; // 20 segundos @ 30fps
  
  // Procesadores especializados para análisis espectral
  private readonly FFT_SIZE = 256;
  private normalizedSpectrums: Map<string, number[]> = new Map();
  
  // Parámetros de optimización
  private readonly CHANNEL_CONFIGS: {[key: string]: {
    gain: number,
    noiseReduction: number,
    frequencyRange: [number, number], // Hz
    amplitudeSensitivity: number,
    temporalWeight: number,
    filterStrength: number,
    outputFormat: 'raw' | 'normalized' | 'derivative'
  }} = {
    // Canal optimizado para detección de picos cardíacos
    'heartRate': {
      gain: 1.2,
      noiseReduction: 0.8,
      frequencyRange: [0.5, 3.0], // 30-180 BPM
      amplitudeSensitivity: 1.0,
      temporalWeight: 0.7,
      filterStrength: 0.75,
      outputFormat: 'raw'
    },
    
    // Canal optimizado para análisis de SpO2
    'oxygenation': {
      gain: 1.0,
      noiseReduction: 0.9,
      frequencyRange: [0.5, 2.5], // 30-150 BPM
      amplitudeSensitivity: 1.1,
      temporalWeight: 0.6,
      filterStrength: 0.85,
      outputFormat: 'normalized'
    },
    
    // Canal optimizado para presión arterial
    'bloodPressure': {
      gain: 1.1,
      noiseReduction: 0.7,
      frequencyRange: [0.6, 2.0], // 36-120 BPM
      amplitudeSensitivity: 1.3,
      temporalWeight: 0.8,
      filterStrength: 0.7,
      outputFormat: 'raw'
    },
    
    // Canal optimizado para arritmias y HRV
    'arrhythmia': {
      gain: 1.4,
      noiseReduction: 0.95,
      frequencyRange: [0.5, 3.5], // 30-210 BPM (más amplio)
      amplitudeSensitivity: 1.2,
      temporalWeight: 0.4, // Menos suavizado para preservar variabilidad
      filterStrength: 0.6,
      outputFormat: 'raw'
    },
    
    // Canal optimizado para glucosa
    'glucose': {
      gain: 1.3,
      noiseReduction: 0.85,
      frequencyRange: [0.5, 2.0], // 30-120 BPM
      amplitudeSensitivity: 1.5, // Mayor sensibilidad para cambios sutiles
      temporalWeight: 0.9, // Mayor suavizado para tendencias
      filterStrength: 0.9,
      outputFormat: 'normalized'
    },
    
    // Canal optimizado para lípidos
    'lipids': {
      gain: 1.25,
      noiseReduction: 0.85,
      frequencyRange: [0.5, 1.8], // 30-108 BPM
      amplitudeSensitivity: 1.4,
      temporalWeight: 0.85,
      filterStrength: 0.85,
      outputFormat: 'normalized'
    },
    
    // Canal optimizado para hemoglobina
    'hemoglobin': {
      gain: 1.15,
      noiseReduction: 0.8,
      frequencyRange: [0.5, 2.2], // 30-132 BPM
      amplitudeSensitivity: 1.3,
      temporalWeight: 0.75,
      filterStrength: 0.8,
      outputFormat: 'normalized'
    },
    
    // Canal para visualización
    'display': {
      gain: 1.5, // Amplificación para mejor visualización
      noiseReduction: 0.7, // Menos reducción para mostrar más detalles
      frequencyRange: [0.3, 5.0], // Amplio rango
      amplitudeSensitivity: 1.0,
      temporalWeight: 0.5,
      filterStrength: 0.5,
      outputFormat: 'raw'
    }
  };
  
  // Estado del optimizador
  private isInitialized: boolean = false;
  private signalQuality: number = 0;
  private lastUpdateTime: number = 0;
  private config: ProcessorConfig;
  
  // Memoria de rendimiento para aprendizaje automático
  private performanceMetrics: Map<string, {
    accuracy: number[],
    confidence: number[],
    errorRate: number[],
    responseTime: number[]
  }> = new Map();
  
  /**
   * Constructor del optimizador adaptativo
   */
  constructor(config: ProcessorConfig) {
    this.config = config;
    this.initializeChannels();
  }
  
  /**
   * Inicializa canales y filtros
   */
  private initializeChannels(): void {
    // Inicializar cada canal con sus filtros específicos
    Object.keys(this.CHANNEL_CONFIGS).forEach(channelName => {
      // Crear canal
      this.channels.set(channelName, {
        name: channelName,
        values: [],
        quality: 0,
        metadata: {
          gain: this.CHANNEL_CONFIGS[channelName].gain,
          snr: 0,
          periodicityScore: 0,
          dominantFrequency: 0,
          amplitudeNormalized: 0,
          optimizationLevel: 0
        }
      });
      
      // Crear filtros personalizados para cada canal
      const channelConfig = this.CHANNEL_CONFIGS[channelName];
      
      // Adaptación para trabajar con las implementaciones actuales de KalmanFilter y WaveletDenoiser
      const kalman = new KalmanFilter();
      // Configurar el filtro Kalman con los parámetros específicos del canal
      kalman.setParameters(
        0.01 * (1 - channelConfig.filterStrength),
        0.1 * (1 - channelConfig.noiseReduction)
      );
      
      const wavelet = new WaveletDenoiser();
      // Establecer umbral para el filtro wavelet
      wavelet.setThreshold(0.025 * channelConfig.noiseReduction);
      
      this.filters.set(channelName, {
        kalman,
        wavelet
      });
      
      // Inicializar espectro
      this.normalizedSpectrums.set(channelName, Array(this.FFT_SIZE/2).fill(0));
      
      // Inicializar métricas de rendimiento
      this.performanceMetrics.set(channelName, {
        accuracy: [],
        confidence: [],
        errorRate: [],
        responseTime: []
      });
    });
    
    this.isInitialized = true;
  }
  
  /**
   * Procesa un nuevo valor PPG y actualiza todos los canales
   * @param ppgValue Valor PPG crudo
   * @returns Mapa de canales optimizados
   */
  public processValue(ppgValue: number): Map<string, OptimizedChannel> {
    // Añadir valor al buffer principal
    this.rawBuffer.push(ppgValue);
    if (this.rawBuffer.length > this.MAX_BUFFER_SIZE) {
      this.rawBuffer.shift();
    }
    
    // Calcular calidad general de la señal
    if (this.rawBuffer.length > 60) {
      this.signalQuality = this.calculateSignalQuality(this.rawBuffer.slice(-60));
    }
    
    // Optimizar cada canal específicamente
    for (const [channelName, channel] of this.channels.entries()) {
      const optimizedValue = this.optimizeValueForChannel(ppgValue, channelName);
      
      // Añadir valor optimizado al canal
      channel.values.push(optimizedValue);
      if (channel.values.length > this.MAX_BUFFER_SIZE) {
        channel.values.shift();
      }
      
      // Actualizar metadatos del canal
      this.updateChannelMetadata(channelName);
    }
    
    // Realizar análisis espectral cada 30 muestras (aprox. 1 segundo a 30fps)
    if (this.rawBuffer.length % 30 === 0) {
      this.performSpectralAnalysis();
    }
    
    // Feedback adaptativo entre canales
    this.applyInterchanelFeedback();
    
    return this.channels;
  }
  
  /**
   * Optimiza un valor específicamente para un canal
   */
  private optimizeValueForChannel(value: number, channelName: string): number {
    if (!this.filters.has(channelName)) {
      return value;
    }
    
    const channelConfig = this.CHANNEL_CONFIGS[channelName];
    const filters = this.filters.get(channelName)!;
    
    // Aplicar ganancia específica del canal
    let optimizedValue = value * channelConfig.gain;
    
    // Aplicar filtrado Kalman
    optimizedValue = filters.kalman.filter(optimizedValue);
    
    // Aplicar denoising wavelet con umbral adaptado al canal
    optimizedValue = filters.wavelet.denoise(optimizedValue);
    
    // Aplicar filtrado basado en rango de frecuencia (si hay suficientes datos)
    if (this.normalizedSpectrums.has(channelName) && this.rawBuffer.length > 64) {
      optimizedValue = this.applyFrequencyRangeFilter(
        optimizedValue, 
        channelName, 
        channelConfig.frequencyRange
      );
    }
    
    // Aplicar formato de salida específico
    switch (channelConfig.outputFormat) {
      case 'normalized':
        // Normalizar a rango 0-1 basado en valores recientes
        const channel = this.channels.get(channelName)!;
        if (channel.values.length > 30) {
          const recentValues = channel.values.slice(-30);
          const min = Math.min(...recentValues);
          const max = Math.max(...recentValues);
          if (max > min) {
            optimizedValue = (optimizedValue - min) / (max - min);
          }
        }
        break;
        
      case 'derivative':
        // Calcular derivada respecto al valor anterior
        const lastValue = this.channels.get(channelName)?.values.slice(-1)[0] || optimizedValue;
        optimizedValue = optimizedValue - lastValue;
        break;
        
      default: // 'raw'
        // Mantener valor tal cual
        break;
    }
    
    return optimizedValue;
  }
  
  /**
   * Aplica filtrado basado en rango de frecuencia
   */
  private applyFrequencyRangeFilter(
    value: number, 
    channelName: string, 
    frequencyRange: [number, number]
  ): number {
    // Obtener espectro del canal
    const spectrum = this.normalizedSpectrums.get(channelName) || [];
    if (spectrum.length === 0) return value;
    
    // Frecuencia de muestreo (asumiendo ~30fps)
    const samplingRate = 30;
    
    // Convertir rango de frecuencia a índices en el espectro
    const minBinIndex = Math.floor((frequencyRange[0] * this.FFT_SIZE) / samplingRate);
    const maxBinIndex = Math.ceil((frequencyRange[1] * this.FFT_SIZE) / samplingRate);
    
    // Calcular ratio de energía dentro vs fuera del rango de frecuencia
    let energyInRange = 0;
    let energyOutOfRange = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      if (i >= minBinIndex && i <= maxBinIndex) {
        energyInRange += spectrum[i];
      } else {
        energyOutOfRange += spectrum[i];
      }
    }
    
    // Si hay más energía fuera del rango que dentro, atenuar el valor
    if (energyOutOfRange > energyInRange && energyInRange > 0) {
      const attenuationFactor = energyInRange / (energyInRange + energyOutOfRange);
      value = value * (0.5 + 0.5 * attenuationFactor);
    }
    
    return value;
  }
  
  /**
   * Realiza análisis espectral de los datos recientes
   */
  private performSpectralAnalysis(): void {
    if (this.rawBuffer.length < this.FFT_SIZE) {
      return;
    }
    
    // Calcular espectro para cada canal
    for (const [channelName, channel] of this.channels.entries()) {
      if (channel.values.length < this.FFT_SIZE) continue;
      
      // Obtener ventana de datos más reciente
      const windowSize = Math.min(this.FFT_SIZE, channel.values.length);
      const windowedData = channel.values.slice(-windowSize);
      
      // Aplicar ventana Hamming para reducir fuga espectral
      const hammingWindow = this.generateHammingWindow(windowSize);
      const windowedSignal = windowedData.map((val, idx) => val * hammingWindow[idx]);
      
      // Calcular FFT (implementación simplificada)
      const spectrum = this.calculatePowerSpectrum(windowedSignal);
      
      // Normalizar espectro
      const maxAmplitude = Math.max(...spectrum);
      const normalizedSpectrum = maxAmplitude > 0 
        ? spectrum.map(val => val / maxAmplitude)
        : spectrum;
      
      // Almacenar espectro normalizado
      this.normalizedSpectrums.set(channelName, normalizedSpectrum);
      
      // Encontrar frecuencia dominante
      let maxBin = 0;
      let maxPower = 0;
      
      for (let i = 1; i < spectrum.length / 4; i++) { // Limitamos a 1/4 de fs/2 para enfocarnos en frecuencias fisiológicas
        if (spectrum[i] > maxPower) {
          maxPower = spectrum[i];
          maxBin = i;
        }
      }
      
      // Convertir bin a frecuencia (Hz)
      const samplingRate = 30; // Aproximadamente 30 Hz
      const dominantFrequency = (maxBin * samplingRate) / this.FFT_SIZE;
      
      // Actualizar metadatos del canal
      const metadata = channel.metadata;
      metadata.dominantFrequency = dominantFrequency;
      
      // Calcular score de periodicidad
      const periodicityScore = this.calculatePeriodicityScore(normalizedSpectrum);
      metadata.periodicityScore = periodicityScore;
    }
  }
  
  /**
   * Genera ventana Hamming del tamaño especificado
   */
  private generateHammingWindow(size: number): number[] {
    return Array(size).fill(0).map((_, i) => 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (size - 1)));
  }
  
  /**
   * Calcula espectro de potencia usando una implementación simplificada de FFT
   */
  private calculatePowerSpectrum(signal: number[]): number[] {
    // Verificar si tenemos potencia de 2
    const paddedLength = this.nextPowerOf2(signal.length);
    const paddedSignal = [...signal];
    
    // Rellenar con ceros si es necesario
    while (paddedSignal.length < paddedLength) {
      paddedSignal.push(0);
    }
    
    // Implementación DFT simplificada
    const spectrum: number[] = [];
    const N = paddedSignal.length;
    
    for (let k = 0; k < N / 2; k++) {
      let realPart = 0;
      let imagPart = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        realPart += paddedSignal[n] * Math.cos(angle);
        imagPart += paddedSignal[n] * Math.sin(angle);
      }
      
      // Calcular magnitud al cuadrado (potencia)
      spectrum[k] = (realPart * realPart + imagPart * imagPart) / N;
    }
    
    return spectrum;
  }
  
  /**
   * Calcula la siguiente potencia de 2
   */
  private nextPowerOf2(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }
  
  /**
   * Calcula score de periodicidad basado en espectro
   */
  private calculatePeriodicityScore(spectrum: number[]): number {
    if (spectrum.length === 0) return 0;
    
    // Encontrar pico máximo
    let maxPower = 0;
    let maxBin = 0;
    
    for (let i = 1; i < spectrum.length / 4; i++) { // Limitamos a frecuencias fisiológicas
      if (spectrum[i] > maxPower) {
        maxPower = spectrum[i];
        maxBin = i;
      }
    }
    
    if (maxPower === 0) return 0;
    
    // Calcular energía total
    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
    
    // Energía en el pico dominante y armónicos
    let peakEnergy = maxPower;
    
    // Incluir posibles armónicos (2x, 3x frecuencia)
    const harmonics = [maxBin * 2, maxBin * 3];
    for (const harmonic of harmonics) {
      if (harmonic < spectrum.length) {
        peakEnergy += spectrum[harmonic];
      }
    }
    
    // Calcular ratio de concentración espectral
    const spectralConcentration = totalEnergy > 0 ? peakEnergy / totalEnergy : 0;
    
    return Math.min(1, spectralConcentration * 2); // Normalizar a rango 0-1
  }
  
  /**
   * Calcula calidad general de la señal
   */
  private calculateSignalQuality(recentValues: number[]): number {
    if (recentValues.length < 30) return 0.5;
    
    // Calcular amplitud
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    const amplitude = max - min;
    
    // Puntuación por amplitud (0-30)
    const amplitudeScore = Math.min(30, amplitude * 100);
    
    // Calcular estabilidad como inverso de varianza relativa (0-30)
    const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    let variance = 0;
    for (const val of recentValues) {
      variance += Math.pow(val - mean, 2);
    }
    variance /= recentValues.length;
    
    const relativeVariance = mean !== 0 ? Math.sqrt(variance) / Math.abs(mean) : 1;
    const stabilityScore = Math.max(0, Math.min(30, 30 * (1 - relativeVariance)));
    
    // Calcular periodicidad mediante autocorrelación (0-40)
    const periodicityScore = this.calculatePeriodicityByAutocorrelation(recentValues) * 40;
    
    // Combinar scores
    const totalScore = amplitudeScore + stabilityScore + periodicityScore;
    
    return Math.min(100, totalScore);
  }
  
  /**
   * Calcula periodicidad por autocorrelación
   */
  private calculatePeriodicityByAutocorrelation(values: number[]): number {
    if (values.length < 30) return 0.5;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const normalizedValues = values.map(val => val - mean);
    
    // Calcular autocorrelación para varios retrasos
    const maxLag = Math.floor(values.length / 2);
    let maxCorrelation = 0;
    
    for (let lag = 5; lag <= maxLag; lag++) { // Empezar desde lag=5 para evitar correlación trivial
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < values.length - lag; i++) {
        correlation += normalizedValues[i] * normalizedValues[i + lag];
        count++;
      }
      
      if (count > 0) {
        correlation /= count;
        maxCorrelation = Math.max(maxCorrelation, Math.abs(correlation));
      }
    }
    
    // Normalizar
    return Math.min(1, maxCorrelation * 2.5);
  }
  
  /**
   * Actualiza metadatos del canal
   */
  private updateChannelMetadata(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (!channel || channel.values.length < 30) return;
    
    const recentValues = channel.values.slice(-30);
    
    // Calcular SNR
    const filtered = this.applyMovingAverage(recentValues, 5);
    let signalPower = 0;
    let noisePower = 0;
    
    for (let i = 0; i < recentValues.length; i++) {
      signalPower += filtered[i] * filtered[i];
      noisePower += Math.pow(recentValues[i] - filtered[i], 2);
    }
    
    const snr = noisePower > 0 ? 10 * Math.log10(signalPower / noisePower) : 20;
    channel.metadata.snr = Math.max(0, Math.min(20, snr));
    
    // Calcular amplitud normalizada
    const max = Math.max(...recentValues);
    const min = Math.min(...recentValues);
    channel.metadata.amplitudeNormalized = max - min;
    
    // Actualizar calidad del canal basado en SNR y periodicidad
    channel.quality = Math.min(100, 
      channel.metadata.snr * 2.5 + 
      channel.metadata.periodicityScore * 50
    );
    
    // Calcular nivel de optimización (qué tan bien está funcionando)
    channel.metadata.optimizationLevel = this.calculateOptimizationLevel(channelName);
  }
  
  /**
   * Aplica promedio móvil simple
   */
  private applyMovingAverage(values: number[], windowSize: number): number[] {
    const result: number[] = [];
    
    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(values.length - 1, i + windowSize); j++) {
        sum += values[j];
        count++;
      }
      
      result.push(sum / count);
    }
    
    return result;
  }
  
  /**
   * Calcula nivel de optimización del canal basado en métricas de rendimiento
   */
  private calculateOptimizationLevel(channelName: string): number {
    const metrics = this.performanceMetrics.get(channelName);
    if (!metrics || metrics.accuracy.length === 0) return 0.5;
    
    // Calcular promedios
    const avgAccuracy = metrics.accuracy.reduce((sum, val) => sum + val, 0) / metrics.accuracy.length;
    const avgConfidence = metrics.confidence.reduce((sum, val) => sum + val, 0) / metrics.confidence.length;
    const avgErrorRate = metrics.errorRate.reduce((sum, val) => sum + val, 0) / metrics.errorRate.length;
    
    // Combinar métricas (más peso a precisión y confianza, menos a tasa de error)
    return Math.min(1, (avgAccuracy * 0.5 + avgConfidence * 0.3 - avgErrorRate * 0.2));
  }
  
  /**
   * Aplica feedback adapatativo entre canales
   */
  private applyInterchanelFeedback(): void {
    // Este método implementa la comunicación bidireccional entre canales
    // Cada 15 actualizaciones (aprox. 0.5 segundos a 30fps)
    if (this.rawBuffer.length % 15 !== 0) return;
    
    // Propagar información de canales de alta calidad a los de baja calidad
    const highQualityChannels = Array.from(this.channels.entries())
      .filter(([_, channel]) => channel.quality > 70)
      .map(([name, _]) => name);
    
    const lowQualityChannels = Array.from(this.channels.entries())
      .filter(([_, channel]) => channel.quality < 50)
      .map(([name, _]) => name);
    
    // No hay nada que hacer si no hay canales de alta o baja calidad
    if (highQualityChannels.length === 0 || lowQualityChannels.length === 0) return;
    
    // Para cada canal de baja calidad, ajustar basado en canales de alta calidad
    for (const lowQualityChannel of lowQualityChannels) {
      const lowChannel = this.channels.get(lowQualityChannel)!;
      const lowFilters = this.filters.get(lowQualityChannel)!;
      
      // Promediar información de canales de alta calidad
      let avgDominantFreq = 0;
      let avgPeriodicityScore = 0;
      
      for (const highQualityChannel of highQualityChannels) {
        const highChannel = this.channels.get(highQualityChannel)!;
        avgDominantFreq += highChannel.metadata.dominantFrequency;
        avgPeriodicityScore += highChannel.metadata.periodicityScore;
      }
      
      avgDominantFreq /= highQualityChannels.length;
      avgPeriodicityScore /= highQualityChannels.length;
      
      // Ajustar filtros del canal de baja calidad
      if (avgDominantFreq > 0) {
        // Ajustar umbrales de filtros basados en periodicidad
        if (avgPeriodicityScore > 0.7) {
          // Alta periodicidad = podemos ser más agresivos con filtrado
          lowFilters.wavelet.setThreshold(0.03 * (2 - avgPeriodicityScore));
          // Usar métodos equivalentes en nuestra implementación actual de KalmanFilter
          lowFilters.kalman.setParameters(
            lowFilters.kalman.getProcessNoise(), 
            lowFilters.kalman.getMeasurementNoise() * (1 - avgPeriodicityScore * 0.3)
          );
        }
      }
    }
  }
  
  /**
   * Retroalimenta el optimizador con resultados de algoritmos de medición
   */
  public provideFeedback(channelName: string, feedback: {
    accuracy?: number;
    confidence?: number;
    errorRate?: number;
    responseTime?: number;
  }): void {
    if (!this.performanceMetrics.has(channelName)) return;
    
    const metrics = this.performanceMetrics.get(channelName)!;
    
    // Actualizar métricas con nuevos valores
    if (feedback.accuracy !== undefined) {
      metrics.accuracy.push(feedback.accuracy);
      if (metrics.accuracy.length > 10) metrics.accuracy.shift();
    }
    
    if (feedback.confidence !== undefined) {
      metrics.confidence.push(feedback.confidence);
      if (metrics.confidence.length > 10) metrics.confidence.shift();
    }
    
    if (feedback.errorRate !== undefined) {
      metrics.errorRate.push(feedback.errorRate);
      if (metrics.errorRate.length > 10) metrics.errorRate.shift();
    }
    
    if (feedback.responseTime !== undefined) {
      metrics.responseTime.push(feedback.responseTime);
      if (metrics.responseTime.length > 10) metrics.responseTime.shift();
    }
    
    // Ajustar parámetros del canal basados en feedback
    this.adjustChannelParameters(channelName);
  }
  
  /**
   * Ajusta parámetros del canal basado en métricas de rendimiento
   */
  private adjustChannelParameters(channelName: string): void {
    if (!this.channels.has(channelName) || !this.filters.has(channelName)) return;
    
    const metrics = this.performanceMetrics.get(channelName);
    if (!metrics || metrics.accuracy.length < 3) return;
    
    const channel = this.channels.get(channelName)!;
    const filters = this.filters.get(channelName)!;
    
    // Calcular tendencias (¿están mejorando o empeorando las métricas?)
    const accuracyTrend = this.calculateTrend(metrics.accuracy);
    const confidenceTrend = this.calculateTrend(metrics.confidence);
    const errorTrend = this.calculateTrend(metrics.errorRate);
    
    // Ajustes basados en tendencias
    if (accuracyTrend < -0.1 || confidenceTrend < -0.1 || errorTrend > 0.1) {
      // Las cosas están empeorando, ajustar parámetros
      
      // Reducir agresividad de filtrado si precisión/confianza están bajando
      if (accuracyTrend < -0.1 || confidenceTrend < -0.1) {
        filters.wavelet.setThreshold(Math.max(0.01, filters.wavelet.getThreshold() * 0.9));
        // Usar la interfaz actual de KalmanFilter
        const currentP = filters.kalman.getProcessNoise();
        const currentM = filters.kalman.getMeasurementNoise();
        filters.kalman.setParameters(
          currentP * 1.1, 
          currentM * 0.9
        );
      }
      
      // Aumentar ganancia si SNR es bajo
      if (channel.metadata.snr < 10) {
        channel.metadata.gain = Math.min(2.0, channel.metadata.gain * 1.05);
      }
    }
    else if (accuracyTrend > 0.1 && confidenceTrend > 0.1 && errorTrend < -0.1) {
      // Las cosas están mejorando, mantener rumbo actual
      
      // Posiblemente ser ligeramente más agresivo con filtrado si todo va bien
      if (channel.quality > 80) {
        filters.wavelet.setThreshold(Math.min(0.05, filters.wavelet.getThreshold() * 1.02));
      }
    }
  }
  
  /**
   * Calcula tendencia en una serie de valores
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 3) return 0;
    
    // Regresión lineal simple
    const n = values.length;
    const x = Array(n).fill(0).map((_, i) => i);
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    // Pendiente
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    return slope;
  }
  
  /**
   * Obtiene valores optimizados para un canal específico
   */
  public getChannelValues(channelName: string): number[] {
    return this.channels.get(channelName)?.values || [];
  }
  
  /**
   * Obtiene canal completo con metadatos
   */
  public getChannel(channelName: string): OptimizedChannel | undefined {
    return this.channels.get(channelName);
  }
  
  /**
   * Obtiene todos los canales
   */
  public getAllChannels(): Map<string, OptimizedChannel> {
    return this.channels;
  }
  
  /**
   * Obtiene calidad general de la señal
   */
  public getSignalQuality(): number {
    return this.signalQuality;
  }
  
  /**
   * Ajusta configuración del optimizador
   */
  public setConfig(config: Partial<ProcessorConfig>): void {
    // Actualizar configuración
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Reinicia el optimizador
   */
  public reset(): void {
    this.rawBuffer = [];
    
    // Reiniciar cada canal
    for (const [channelName, channel] of this.channels.entries()) {
      channel.values = [];
      channel.quality = 0;
      channel.metadata.snr = 0;
      channel.metadata.periodicityScore = 0;
      channel.metadata.dominantFrequency = 0;
      channel.metadata.amplitudeNormalized = 0;
      channel.metadata.optimizationLevel = 0;
      
      // Reiniciar filtros
      const filters = this.filters.get(channelName);
      if (filters) {
        filters.kalman.reset();
        filters.wavelet.reset();
      }
      
      // Reiniciar espectro
      this.normalizedSpectrums.set(channelName, Array(this.FFT_SIZE/2).fill(0));
      
      // Reiniciar métricas
      const metrics = this.performanceMetrics.get(channelName);
      if (metrics) {
        metrics.accuracy = [];
        metrics.confidence = [];
        metrics.errorRate = [];
        metrics.responseTime = [];
      }
    }
    
    this.signalQuality = 0;
    this.lastUpdateTime = 0;
  }
}

// Extender las interfaces para KalmanFilter y WaveletDenoiser
// para incluir los métodos adicionales necesarios para AdaptiveOptimizer

// Extender KalmanFilter
declare module './filters/KalmanFilter' {
  interface KalmanFilter {
    getProcessNoise(): number;
    getMeasurementNoise(): number;
    adjustNoiseParameters(factor: number): void;
  }
}

// Extender WaveletDenoiser
declare module './filters/WaveletDenoiser' {
  interface WaveletDenoiser {
    getThreshold(): number;
    setThreshold(threshold: number): void;
    resetToDefaults(): void;
    setLowComplexityMode(enabled: boolean): void;
  }
}

// Implementar métodos adicionales para KalmanFilter
KalmanFilter.prototype.getProcessNoise = function(): number {
  return this.Q;
};

KalmanFilter.prototype.getMeasurementNoise = function(): number {
  return this.R;
};

KalmanFilter.prototype.adjustNoiseParameters = function(factor: number): void {
  this.R = Math.max(0.001, this.R * (1 - factor * 0.3));
};

// Implementar métodos adicionales para WaveletDenoiser
WaveletDenoiser.prototype.getThreshold = function(): number {
  return this.THRESHOLD;
};

WaveletDenoiser.prototype.setThreshold = function(threshold: number): void {
  this.THRESHOLD = threshold;
};

WaveletDenoiser.prototype.resetToDefaults = function(): void {
  this.THRESHOLD = 0.025;
  this.buffer = [];
};

WaveletDenoiser.prototype.setLowComplexityMode = function(enabled: boolean): void {
  // Este método no hace nada en la implementación actual,
  // pero se mantiene para compatibilidad con la interfaz
};
