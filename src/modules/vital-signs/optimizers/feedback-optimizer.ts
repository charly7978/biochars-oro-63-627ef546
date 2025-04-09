
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Sistema avanzado de optimización bidireccional completamente renovado
 * Utiliza técnicas de análisis espectral y adaptación temporal
 */
export class FeedbackOptimizer {
  // Historial multinivel para análisis de frecuencia y amplitud
  private spectralHistory: number[][] = [];
  private amplitudeHistogram: Map<number, number> = new Map();
  private periodicityMatrix: number[][] = [];
  private feedbackHistory: FeedbackData[] = [];
  
  // Sistema de ponderación tridimensional
  private channelMatrix = {
    filtered: { weight: 0.6, confidence: 0.7, adaptationRate: 0.05 },
    raw: { weight: 0.4, confidence: 0.5, adaptationRate: 0.06 },
    derivative: { weight: 0.0, confidence: 0.3, adaptationRate: 0.08 }
  };
  
  // Parámetros avanzados
  private optimizationCycles: number = 0;
  private adaptiveThresholds = {
    quality: 30,
    periodicity: 0.25,
    amplitude: 0.08
  };
  
  // Sistema de memoria de patrón
  private patternBank: Map<string, number> = new Map();
  private currentPatternSequence: number[] = [];
  private readonly patternLength: number = 8;
  
  constructor() {
    console.log("FeedbackOptimizer: Sistema totalmente renovado con análisis multinivel");
    this.initializePatternBank();
  }
  
  /**
   * Optimizador multidimensional con detección adaptativa de patrones
   */
  public optimize(
    filteredValues: number[], 
    rawValues: number[], 
    signalQuality: number
  ): OptimizationResult {
    this.optimizationCycles++;
    
    // Preparación y normalización de datos
    const processedFilteredValues = this.preprocessSignal(filteredValues);
    const processedRawValues = this.preprocessSignal(rawValues);
    
    // Análisis espectral para detección de periodocidad real
    const spectralFeatures = this.extractSpectralFeatures(processedFilteredValues);
    this.spectralHistory.push(spectralFeatures);
    if (this.spectralHistory.length > 20) {
      this.spectralHistory.shift();
    }
    
    // Actualizar histograma de amplitud para reconocimiento de patrones
    this.updateAmplitudeHistogram(processedFilteredValues, processedRawValues);
    
    // Extraer y registrar características periódicas
    const periodicityFeatures = this.extractPeriodicityFeatures(
      processedFilteredValues,
      processedRawValues
    );
    this.periodicityMatrix.push(periodicityFeatures);
    if (this.periodicityMatrix.length > 15) {
      this.periodicityMatrix.shift();
    }
    
    // Ajustar pesos de canales con algoritmo adaptativo avanzado
    this.adaptChannelWeights(signalQuality, spectralFeatures, periodicityFeatures);
    
    // Incorporar análisis de derivada como canal complementario
    const derivativeValues = this.calculateDerivative(filteredValues);
    
    // Aplicar optimización multinivel con nueva arquitectura
    const optimizedValues: number[] = this.applyMultilevelOptimization(
      processedFilteredValues,
      processedRawValues,
      derivativeValues
    );
    
    // Calcular calidad con algoritmo mejorado
    const optimizationQuality = this.calculateEnhancedQuality(
      spectralFeatures, 
      periodicityFeatures,
      signalQuality
    );
    
    // Reconocimiento y registro de patrones para optimización futura
    this.updatePatternRecognition(optimizedValues);
    
    // Log detallado periódico
    if (this.optimizationCycles % 10 === 0) {
      console.log("FeedbackOptimizer: Optimización avanzada completada", {
        ciclo: this.optimizationCycles,
        calidadSeñal: signalQuality,
        calidadOptimización: optimizationQuality,
        pesosCanales: {
          filtrado: this.channelMatrix.filtered.weight,
          crudo: this.channelMatrix.raw.weight,
          derivada: this.channelMatrix.derivative.weight
        },
        confiabildadCanales: {
          filtrado: this.channelMatrix.filtered.confidence,
          crudo: this.channelMatrix.raw.confidence,
          derivada: this.channelMatrix.derivative.confidence
        },
        patronesDetectados: this.patternBank.size,
        caracteristicasEspectrales: spectralFeatures.slice(0, 3)
      });
    }
    
    return {
      optimizedValues,
      channelWeights: { 
        filtered: this.channelMatrix.filtered.weight, 
        raw: this.channelMatrix.raw.weight
      },
      optimizationQuality,
      signalQuality
    };
  }
  
  /**
   * Sistema de feedback bidireccional mejorado
   */
  public provideFeedback(feedback: FeedbackData): void {
    this.feedbackHistory.push(feedback);
    
    // Mantener historial con enfoque FIFO
    if (this.feedbackHistory.length > 15) {
      this.feedbackHistory.shift();
    }
    
    // Extraer características multinivel del feedback
    const consistencyFeatures = this.extractConsistencyFeatures(feedback);
    
    // Ajustar umbrales de calidad con enfoque predictivo
    this.adaptQualityThreshold(feedback, consistencyFeatures);
    
    // Optimizar tasas de adaptación basadas en consistencia
    this.optimizeAdaptationRates(consistencyFeatures);
    
    // Actualizar banco de patrones con retroalimentación
    this.enhancePatternBank(feedback);
    
    console.log("FeedbackOptimizer: Feedback avanzado procesado", {
      consistenciaSPO2: feedback.spo2.consistency,
      consistenciaPresion: feedback.bloodPressure.consistency,
      calidadSeñal: feedback.signalQuality,
      umbralCalidadActualizado: this.adaptiveThresholds.quality,
      umbralPeriodicidadActualizado: this.adaptiveThresholds.periodicity,
      caracteristicasConsistencia: consistencyFeatures
    });
  }
  
  /**
   * Preprocesamiento avanzado de señal
   */
  private preprocessSignal(values: number[]): number[] {
    if (values.length === 0) return [];
    
    // Obtener segmento reciente para análisis local
    const recentValues = values.slice(-Math.min(values.length, 30));
    
    // Normalización adaptativa
    const min = Math.min(...recentValues);
    const max = Math.max(...recentValues);
    const range = max - min > 0 ? max - min : 1;
    
    // Aplicar normalización con preservación de forma de onda
    return recentValues.map(v => (v - min) / range);
  }
  
  /**
   * Extracción de características espectrales
   */
  private extractSpectralFeatures(values: number[]): number[] {
    if (values.length < 10) return [0, 0, 0, 0, 0];
    
    // Análisis estadístico para características espectrales
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Varianza: dispersión de valores
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    
    // Asimetría: medida de la asimetría de la distribución
    let skewness = 0;
    if (variance > 0) {
      const cubedDeviations = values.map(v => Math.pow(v - mean, 3));
      skewness = (cubedDeviations.reduce((a, b) => a + b, 0) / values.length) / Math.pow(variance, 1.5);
    }
    
    // Frecuencia dominante (simplificada): número de cruces por el valor medio
    let crossings = 0;
    for (let i = 1; i < values.length; i++) {
      if ((values[i] > mean && values[i-1] <= mean) || 
          (values[i] < mean && values[i-1] >= mean)) {
        crossings++;
      }
    }
    const dominantFrequency = crossings / values.length;
    
    // Energía de señal: suma de cuadrados normalizada
    const energy = values.reduce((acc, val) => acc + val * val, 0) / values.length;
    
    return [mean, variance, skewness, dominantFrequency, energy];
  }
  
  /**
   * Actualización de histograma de amplitud para reconocimiento de patrones
   */
  private updateAmplitudeHistogram(filteredValues: number[], rawValues: number[]): void {
    if (filteredValues.length < 5 || rawValues.length < 5) return;
    
    // Calcular amplitudes para ambos canales
    const filteredAmplitude = Math.max(...filteredValues) - Math.min(...filteredValues);
    const rawAmplitude = Math.max(...rawValues) - Math.min(...rawValues);
    
    // Discretizar para histograma (resolución de 0.05)
    const filteredBin = Math.floor(filteredAmplitude * 20) / 20;
    const rawBin = Math.floor(rawAmplitude * 20) / 20;
    
    // Actualizar histograma de filtrado
    this.amplitudeHistogram.set(
      filteredBin,
      (this.amplitudeHistogram.get(filteredBin) || 0) + 1
    );
    
    // Actualizar histograma de crudo
    this.amplitudeHistogram.set(
      rawBin + 100, // Offset para diferenciar canales
      (this.amplitudeHistogram.get(rawBin + 100) || 0) + 1
    );
    
    // Limitar tamaño de histograma
    if (this.amplitudeHistogram.size > 50) {
      // Eliminar entradas menos frecuentes
      const entries = Array.from(this.amplitudeHistogram.entries());
      entries.sort((a, b) => a[1] - b[1]);
      
      for (let i = 0; i < Math.min(5, entries.length); i++) {
        this.amplitudeHistogram.delete(entries[i][0]);
      }
    }
  }
  
  /**
   * Extracción de características periódicas
   */
  private extractPeriodicityFeatures(filteredValues: number[], rawValues: number[]): number[] {
    if (filteredValues.length < 10 || rawValues.length < 10) return [0, 0, 0, 0];
    
    // Autocorrelación para periodicidad (filtrado)
    const filteredAutocorr = this.calculateAutocorrelation(filteredValues);
    
    // Autocorrelación para periodicidad (crudo)
    const rawAutocorr = this.calculateAutocorrelation(rawValues);
    
    // Diferencia de fase entre canales
    const phaseDifference = this.calculatePhaseDifference(filteredValues, rawValues);
    
    // Índice de coherencia entre canales
    const coherenceIndex = this.calculateCoherenceIndex(filteredValues, rawValues);
    
    return [
      filteredAutocorr, 
      rawAutocorr, 
      phaseDifference,
      coherenceIndex
    ];
  }
  
  /**
   * Cálculo de autocorrelación para análisis de periodicidad
   */
  private calculateAutocorrelation(values: number[]): number {
    if (values.length < 10) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const normalizedValues = values.map(v => v - mean);
    
    // Calcular autocorrelación con desfase óptimo
    const maxLag = Math.floor(values.length / 3);
    let bestAutocorr = 0;
    let bestLag = 0;
    
    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      let count = 0;
      
      for (let i = 0; i < values.length - lag; i++) {
        sum += normalizedValues[i] * normalizedValues[i + lag];
        count++;
      }
      
      const autocorr = count > 0 ? sum / count : 0;
      
      if (autocorr > bestAutocorr) {
        bestAutocorr = autocorr;
        bestLag = lag;
      }
    }
    
    // Normalizar entre 0-1
    return bestAutocorr > 0 ? Math.min(1, bestAutocorr) : 0;
  }
  
  /**
   * Cálculo de diferencia de fase entre canales
   */
  private calculatePhaseDifference(signal1: number[], signal2: number[]): number {
    if (signal1.length < 10 || signal2.length < 10) return 0;
    
    // Simplificación: correlación cruzada para estimar diferencia de fase
    const maxLag = Math.floor(signal1.length / 4);
    let bestCorrelation = -1;
    let bestLag = 0;
    
    for (let lag = -maxLag; lag <= maxLag; lag++) {
      let sum = 0;
      let count = 0;
      
      for (let i = 0; i < signal1.length; i++) {
        const j = i + lag;
        if (j >= 0 && j < signal2.length) {
          sum += signal1[i] * signal2[j];
          count++;
        }
      }
      
      const correlation = count > 0 ? sum / count : 0;
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestLag = lag;
      }
    }
    
    // Normalizar a [0,1] donde 0 = perfectamente en fase, 1 = fase opuesta
    return Math.abs(bestLag) / maxLag;
  }
  
  /**
   * Cálculo de índice de coherencia entre canales
   */
  private calculateCoherenceIndex(signal1: number[], signal2: number[]): number {
    if (signal1.length < 5 || signal2.length < 5) return 0;
    
    // Usamos correlación de Pearson para medir coherencia
    const length = Math.min(signal1.length, signal2.length);
    const s1 = signal1.slice(0, length);
    const s2 = signal2.slice(0, length);
    
    const mean1 = s1.reduce((a, b) => a + b, 0) / length;
    const mean2 = s2.reduce((a, b) => a + b, 0) / length;
    
    let num = 0;
    let den1 = 0;
    let den2 = 0;
    
    for (let i = 0; i < length; i++) {
      const diff1 = s1[i] - mean1;
      const diff2 = s2[i] - mean2;
      
      num += diff1 * diff2;
      den1 += diff1 * diff1;
      den2 += diff2 * diff2;
    }
    
    const pearson = (den1 * den2 > 0) ? num / Math.sqrt(den1 * den2) : 0;
    
    // Convertir de [-1,1] a [0,1] donde 1 = perfectamente coherente
    return (pearson + 1) / 2;
  }
  
  /**
   * Adaptación avanzada de pesos de canales
   */
  private adaptChannelWeights(
    signalQuality: number, 
    spectralFeatures: number[],
    periodicityFeatures: number[]
  ): void {
    if (this.spectralHistory.length < 3) return;
    
    // Calcular confianza por canal basada en características
    const filteredConfidence = this.calculateChannelConfidence(
      'filtered', spectralFeatures, periodicityFeatures[0]
    );
    
    const rawConfidence = this.calculateChannelConfidence(
      'raw', spectralFeatures, periodicityFeatures[1]
    );
    
    const derivativeConfidence = Math.max(0, Math.min(0.8, 1 - periodicityFeatures[2]));
    
    // Actualizar confianzas con tasa de adaptación específica de canal
    this.channelMatrix.filtered.confidence = 
      (1 - this.channelMatrix.filtered.adaptationRate) * this.channelMatrix.filtered.confidence +
      this.channelMatrix.filtered.adaptationRate * filteredConfidence;
    
    this.channelMatrix.raw.confidence = 
      (1 - this.channelMatrix.raw.adaptationRate) * this.channelMatrix.raw.confidence +
      this.channelMatrix.raw.adaptationRate * rawConfidence;
    
    this.channelMatrix.derivative.confidence = 
      (1 - this.channelMatrix.derivative.adaptationRate) * this.channelMatrix.derivative.confidence +
      this.channelMatrix.derivative.adaptationRate * derivativeConfidence;
    
    // Calcular pesos relativos basados en confianza
    const totalConfidence = 
      this.channelMatrix.filtered.confidence + 
      this.channelMatrix.raw.confidence + 
      this.channelMatrix.derivative.confidence;
    
    if (totalConfidence > 0) {
      this.channelMatrix.filtered.weight = this.channelMatrix.filtered.confidence / totalConfidence;
      this.channelMatrix.raw.weight = this.channelMatrix.raw.confidence / totalConfidence;
      this.channelMatrix.derivative.weight = this.channelMatrix.derivative.confidence / totalConfidence;
    }
    
    // Ajuste fino basado en calidad de señal
    if (signalQuality < 40) {
      // Con baja calidad, incrementar peso de derivada que puede detectar cambios sutiles
      const transferAmount = Math.max(0, 0.1 - this.channelMatrix.derivative.weight) * 0.5;
      this.channelMatrix.derivative.weight += transferAmount;
      this.channelMatrix.filtered.weight -= transferAmount * 0.6;
      this.channelMatrix.raw.weight -= transferAmount * 0.4;
    } else if (signalQuality > 70) {
      // Con alta calidad, favorecer señal filtrada
      const transferAmount = Math.min(this.channelMatrix.derivative.weight, 0.05);
      this.channelMatrix.derivative.weight -= transferAmount;
      this.channelMatrix.filtered.weight += transferAmount * 0.8;
      this.channelMatrix.raw.weight += transferAmount * 0.2;
    }
    
    // Asegurar límites razonables y suma = 1
    this.normalizeChannelWeights();
  }
  
  /**
   * Cálculo de confianza por canal
   */
  private calculateChannelConfidence(
    channel: 'filtered' | 'raw' | 'derivative',
    spectralFeatures: number[],
    periodicityScore: number
  ): number {
    // Extraer características relevantes
    const [mean, variance, skewness, dominantFrequency, energy] = spectralFeatures;
    
    // Diferentes métricas según canal
    if (channel === 'filtered') {
      // Canal filtrado: valorar estabilidad y periodicidad
      const stabilityScore = Math.max(0, 1 - variance * 5);
      const periodicityWeight = 0.7;
      const stabilityWeight = 0.3;
      
      return (periodicityScore * periodicityWeight) + (stabilityScore * stabilityWeight);
    } 
    else if (channel === 'raw') {
      // Canal crudo: valorar energía y variabilidad
      const energyScore = Math.min(1, energy * 2);
      const variabilityScore = Math.min(1, variance * 8);
      
      return (energyScore * 0.6) + (variabilityScore * 0.4);
    }
    else {
      // Canal derivado: valorar cambios rápidos
      const changeScore = Math.min(1, dominantFrequency * 3);
      return changeScore * 0.9;
    }
  }
  
  /**
   * Normalizador de pesos de canales
   */
  private normalizeChannelWeights(): void {
    // Limitar pesos a rangos razonables
    this.channelMatrix.derivative.weight = Math.max(0, Math.min(0.2, this.channelMatrix.derivative.weight));
    this.channelMatrix.filtered.weight = Math.max(0.3, Math.min(0.8, this.channelMatrix.filtered.weight));
    this.channelMatrix.raw.weight = Math.max(0.1, Math.min(0.6, this.channelMatrix.raw.weight));
    
    // Renormalizar para suma = 1
    const total = 
      this.channelMatrix.filtered.weight + 
      this.channelMatrix.raw.weight + 
      this.channelMatrix.derivative.weight;
    
    if (total > 0) {
      this.channelMatrix.filtered.weight /= total;
      this.channelMatrix.raw.weight /= total;
      this.channelMatrix.derivative.weight /= total;
    } else {
      // Valores por defecto
      this.channelMatrix.filtered.weight = 0.6;
      this.channelMatrix.raw.weight = 0.35;
      this.channelMatrix.derivative.weight = 0.05;
    }
  }
  
  /**
   * Cálculo de derivada de señal
   */
  private calculateDerivative(values: number[]): number[] {
    if (values.length < 3) return [];
    
    const derivative: number[] = [];
    
    for (let i = 1; i < values.length; i++) {
      derivative.push(values[i] - values[i - 1]);
    }
    
    return derivative;
  }
  
  /**
   * Aplicación de optimización multinivel
   */
  private applyMultilevelOptimization(
    filteredValues: number[],
    rawValues: number[],
    derivativeValues: number[]
  ): number[] {
    const optimizedValues: number[] = [];
    const minLength = Math.min(
      filteredValues.length, 
      rawValues.length,
      derivativeValues.length + 1
    );
    
    for (let i = 0; i < minLength; i++) {
      // Valor base ponderado
      let optimizedValue = 
        (filteredValues[i] * this.channelMatrix.filtered.weight) + 
        (rawValues[i] * this.channelMatrix.raw.weight);
      
      // Incorporar componente de derivada si está disponible
      if (i > 0 && derivativeValues.length >= i) {
        optimizedValue += derivativeValues[i - 1] * this.channelMatrix.derivative.weight;
      }
      
      // Aplicar corrección con banco de patrones si hay coincidencia
      const patternCorrection = this.applyPatternCorrection(
        filteredValues, i, optimizedValue
      );
      
      optimizedValues.push(patternCorrection);
    }
    
    return optimizedValues;
  }
  
  /**
   * Aplicación de corrección basada en patrones
   */
  private applyPatternCorrection(
    values: number[], 
    currentIndex: number, 
    baseValue: number
  ): number {
    if (this.patternBank.size === 0 || values.length < this.patternLength || 
        currentIndex < this.patternLength - 1) {
      return baseValue;
    }
    
    // Extraer patrón reciente
    const recentPattern = values.slice(
      currentIndex - (this.patternLength - 1), 
      currentIndex + 1
    );
    
    // Normalizar patrón
    const normalizedPattern = this.normalizePattern(recentPattern);
    
    // Convertir a código hash para búsqueda eficiente
    const patternCode = this.patternToCode(normalizedPattern);
    
    // Verificar si el patrón existe en el banco
    if (this.patternBank.has(patternCode)) {
      const correctionFactor = this.patternBank.get(patternCode) || 0;
      
      // Aplicar corrección sutil
      return baseValue * (1 + correctionFactor * 0.1);
    }
    
    return baseValue;
  }
  
  /**
   * Normalización de patrón para comparación
   */
  private normalizePattern(pattern: number[]): number[] {
    if (pattern.length === 0) return [];
    
    const min = Math.min(...pattern);
    const max = Math.max(...pattern);
    const range = max - min > 0 ? max - min : 1;
    
    return pattern.map(v => Math.round((v - min) / range * 10) / 10);
  }
  
  /**
   * Convertir patrón a código para indexación
   */
  private patternToCode(pattern: number[]): string {
    return pattern.map(v => v.toFixed(1)).join('|');
  }
  
  /**
   * Inicializar banco de patrones con formas comunes de onda
   */
  private initializePatternBank(): void {
    // Patrón sinusoidal
    const sinPattern = Array.from({length: this.patternLength}, 
      (_, i) => Math.sin(i / this.patternLength * Math.PI * 2));
    this.patternBank.set(
      this.patternToCode(this.normalizePattern(sinPattern)), 0.05
    );
    
    // Patrón dicrotic notch (común en PPG)
    const dicroticPattern = Array.from({length: this.patternLength}, 
      (_, i) => {
        const x = i / this.patternLength;
        return Math.sin(x * Math.PI) * (1 - 0.3 * Math.exp(-30 * Math.pow(x - 0.6, 2)));
      });
    this.patternBank.set(
      this.patternToCode(this.normalizePattern(dicroticPattern)), 0.08
    );
  }
  
  /**
   * Actualización de reconocimiento de patrones
   */
  private updatePatternRecognition(values: number[]): void {
    if (values.length < this.patternLength) return;
    
    // Extraer segmento más reciente
    const recentSegment = values.slice(-this.patternLength);
    
    // Actualizar secuencia actual (discretizada para reconocimiento)
    this.currentPatternSequence = recentSegment.map(
      v => Math.floor(v * 10) / 10
    );
    
    // Si el banco supera el tamaño máximo, eliminar entradas antiguas
    if (this.patternBank.size > 50) {
      // Eliminar entradas con menor corrección
      const entries = Array.from(this.patternBank.entries());
      entries.sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]));
      
      for (let i = 0; i < Math.min(5, entries.length); i++) {
        this.patternBank.delete(entries[i][0]);
      }
    }
  }
  
  /**
   * Cálculo avanzado de calidad de optimización
   */
  private calculateEnhancedQuality(
    spectralFeatures: number[],
    periodicityFeatures: number[],
    signalQuality: number
  ): number {
    // Calcular calidad base a partir de características espectrales
    const [_, variance, skewness, dominantFrequency, energy] = spectralFeatures;
    
    // Calidad de periodicidad (fundamental para señales biológicas)
    const periodicityQuality = (periodicityFeatures[0] + periodicityFeatures[1]) / 2;
    
    // Calidad de coherencia (consistencia entre canales)
    const coherenceQuality = periodicityFeatures[3];
    
    // Factor de energía normalizada
    const energyQuality = Math.min(1, energy * 3);
    
    // Calcular calidad ponderada
    let optimizationQuality = 
      (periodicityQuality * 0.35) +
      (coherenceQuality * 0.25) +
      (energyQuality * 0.20) +
      (signalQuality / 100 * 0.20);
    
    // Penalizar alta varianza (indica inestabilidad)
    if (variance > 0.3) {
      optimizationQuality *= Math.max(0.5, 1 - (variance - 0.3));
    }
    
    // Aplicar tendencia de calidad con historial
    if (this.spectralHistory.length > 5) {
      const recentQualityTrend = this.calculateQualityTrend();
      optimizationQuality *= (1 + recentQualityTrend * 0.2);
    }
    
    // Escalar a 0-100 y aplicar límites
    return Math.max(0, Math.min(100, optimizationQuality * 100));
  }
  
  /**
   * Cálculo de tendencia de calidad
   */
  private calculateQualityTrend(): number {
    if (this.spectralHistory.length < 5) return 0;
    
    // Extraer energía (último valor) de cada conjunto de características
    const energyHistory = this.spectralHistory.map(features => features[4]);
    
    // Calcular tendencia (positiva o negativa)
    let sumDiffs = 0;
    for (let i = 1; i < energyHistory.length; i++) {
      sumDiffs += (energyHistory[i] - energyHistory[i-1]);
    }
    
    // Normalizar a [-0.2, 0.2]
    return Math.max(-0.2, Math.min(0.2, sumDiffs));
  }
  
  /**
   * Extracción de características de consistencia del feedback
   */
  private extractConsistencyFeatures(feedback: FeedbackData): number[] {
    // Convertir consistencia textual a numérica
    const spo2Consistency = this.consistencyToNumber(feedback.spo2.consistency);
    const bpConsistency = this.consistencyToNumber(feedback.bloodPressure.consistency);
    
    // Normalizar calidad de señal
    const normalizedQuality = feedback.signalQuality / 100;
    
    // Histórico reciente
    const recentSpO2Consistency = this.getRecentConsistencyAverage('spo2');
    const recentBPConsistency = this.getRecentConsistencyAverage('bloodPressure');
    
    // Mejoría relativa a historial
    const spo2Improvement = spo2Consistency - recentSpO2Consistency;
    const bpImprovement = bpConsistency - recentBPConsistency;
    
    return [
      spo2Consistency,
      bpConsistency,
      normalizedQuality,
      spo2Improvement,
      bpImprovement
    ];
  }
  
  /**
   * Conversión de consistencia textual a numérica
   */
  private consistencyToNumber(consistency: 'low' | 'medium' | 'high'): number {
    switch(consistency) {
      case 'high': return 1.0;
      case 'medium': return 0.5;
      case 'low': return 0.0;
      default: return 0.0;
    }
  }
  
  /**
   * Obtención de promedio de consistencia reciente
   */
  private getRecentConsistencyAverage(metric: 'spo2' | 'bloodPressure'): number {
    if (this.feedbackHistory.length === 0) return 0;
    
    const recentHistory = this.feedbackHistory.slice(-Math.min(5, this.feedbackHistory.length));
    
    const sum = recentHistory.reduce((acc, feedback) => {
      return acc + this.consistencyToNumber(feedback[metric].consistency);
    }, 0);
    
    return sum / recentHistory.length;
  }
  
  /**
   * Adaptación de umbral de calidad con nueva estrategia
   */
  private adaptQualityThreshold(feedback: FeedbackData, consistencyFeatures: number[]): void {
    // Extraer características relevantes
    const [spo2Consistency, bpConsistency, normalizedQuality, spo2Improvement, bpImprovement] = consistencyFeatures;
    
    // Factor combinado de mejora
    const improvementFactor = (spo2Improvement + bpImprovement) / 2;
    
    // Determinar dirección de ajuste
    let adjustment = 0;
    
    if (spo2Consistency > 0.7 && bpConsistency > 0.7) {
      // Alta consistencia en ambas métricas: podemos ser más exigentes
      adjustment = 1 + improvementFactor;
    } 
    else if (spo2Consistency < 0.3 && bpConsistency < 0.3) {
      // Baja consistencia en ambas métricas: ser menos exigentes
      adjustment = -2 - improvementFactor;
    }
    else if (improvementFactor > 0) {
      // Tendencia positiva: ligero incremento
      adjustment = 0.5;
    }
    else if (improvementFactor < 0) {
      // Tendencia negativa: ligera reducción
      adjustment = -0.5;
    }
    
    // Ajustar umbral con limitación adaptativa
    this.adaptiveThresholds.quality = Math.max(
      20, Math.min(65, this.adaptiveThresholds.quality + adjustment)
    );
    
    // Ajustar umbrales relacionados
    this.adaptiveThresholds.periodicity = 
      this.adaptiveThresholds.quality > 50 ? 0.3 : 0.2;
    
    this.adaptiveThresholds.amplitude = 
      this.adaptiveThresholds.quality > 45 ? 0.1 : 0.05;
  }
  
  /**
   * Optimización de tasas de adaptación
   */
  private optimizeAdaptationRates(consistencyFeatures: number[]): void {
    // Extraer características
    const [spo2Consistency, bpConsistency, normalizedQuality] = consistencyFeatures;
    
    // Calcular consistencia general
    const overallConsistency = (spo2Consistency + bpConsistency) / 2;
    
    // Ajustar tasas de adaptación inversamente a la consistencia
    // Con alta consistencia: adaptación más lenta (más estabilidad)
    // Con baja consistencia: adaptación más rápida (más reactividad)
    
    if (overallConsistency > 0.7) {
      // Alta consistencia: adaptación más lenta
      this.channelMatrix.filtered.adaptationRate = 0.03;
      this.channelMatrix.raw.adaptationRate = 0.04;
      this.channelMatrix.derivative.adaptationRate = 0.05;
    } 
    else if (overallConsistency < 0.3) {
      // Baja consistencia: adaptación más rápida
      this.channelMatrix.filtered.adaptationRate = 0.08;
      this.channelMatrix.raw.adaptationRate = 0.1;
      this.channelMatrix.derivative.adaptationRate = 0.12;
    }
    else {
      // Consistencia media: valores intermedios
      this.channelMatrix.filtered.adaptationRate = 0.05;
      this.channelMatrix.raw.adaptationRate = 0.06;
      this.channelMatrix.derivative.adaptationRate = 0.08;
    }
    
    // Ajuste adicional basado en calidad de señal
    if (normalizedQuality < 0.4) {
      // Con señal deficiente, aumentar adaptabilidad
      this.channelMatrix.filtered.adaptationRate += 0.02;
      this.channelMatrix.raw.adaptationRate += 0.02;
      this.channelMatrix.derivative.adaptationRate += 0.03;
    }
  }
  
  /**
   * Mejora del banco de patrones con feedback
   */
  private enhancePatternBank(feedback: FeedbackData): void {
    if (this.currentPatternSequence.length < this.patternLength) return;
    
    // Sólo mejorar patrones con consistencia suficiente
    const consistencyFactor = 
      this.consistencyToNumber(feedback.spo2.consistency) * 0.5 +
      this.consistencyToNumber(feedback.bloodPressure.consistency) * 0.5;
    
    if (consistencyFactor < 0.3) return;
    
    // Normalizar patrón actual
    const normalizedPattern = this.normalizePattern(this.currentPatternSequence);
    const patternCode = this.patternToCode(normalizedPattern);
    
    // Factor de corrección basado en consistencia
    const correctionFactor = (consistencyFactor - 0.5) * 0.2;
    
    // Actualizar o añadir al banco
    if (this.patternBank.has(patternCode)) {
      const currentFactor = this.patternBank.get(patternCode) || 0;
      this.patternBank.set(patternCode, currentFactor + correctionFactor * 0.1);
    } else {
      this.patternBank.set(patternCode, correctionFactor);
    }
  }
  
  /**
   * Reinicio del optimizador
   */
  public reset(): void {
    this.spectralHistory = [];
    this.amplitudeHistogram.clear();
    this.periodicityMatrix = [];
    this.feedbackHistory = [];
    
    this.channelMatrix = {
      filtered: { weight: 0.6, confidence: 0.7, adaptationRate: 0.05 },
      raw: { weight: 0.4, confidence: 0.5, adaptationRate: 0.06 },
      derivative: { weight: 0.0, confidence: 0.3, adaptationRate: 0.08 }
    };
    
    this.optimizationCycles = 0;
    this.adaptiveThresholds = {
      quality: 30,
      periodicity: 0.25,
      amplitude: 0.08
    };
    
    this.patternBank.clear();
    this.currentPatternSequence = [];
    this.initializePatternBank();
    
    console.log("FeedbackOptimizer: Sistema reiniciado completamente");
  }
}

/**
 * Interfaz para datos de feedback
 */
export interface FeedbackData {
  spo2: {
    value: number;
    consistency: 'low' | 'medium' | 'high';
  };
  bloodPressure: {
    value: { systolic: number; diastolic: number };
    consistency: 'low' | 'medium' | 'high';
  };
  signalQuality: number;
  timestamp: number;
}

/**
 * Interfaz para resultados de optimización
 */
export interface OptimizationResult {
  optimizedValues: number[];
  channelWeights: {
    filtered: number;
    raw: number;
  };
  optimizationQuality: number;
  signalQuality: number;
}
