import { 
  BaseNeuralModel, 
  DenseLayer, 
  Conv1DLayer, 
  LSTMLayer,
  AttentionLayer,
  BatchNormLayer,
  TensorUtils,
  Tensor1D 
} from './NeuralNetworkBase';
import * as tf from '@tensorflow/tfjs'; // Asegúrate de tener @tensorflow/tfjs instalado

/**
 * Modelo neuronal para estimación de glucosa en sangre
 * 
 * Arquitectura:
 * 1. Capas convolucionales para extracción de características espectrales
 * 2. Capa LSTM para análisis de cambios temporales
 * 3. Mecanismo de atención para enfocarse en regiones clave
 * 4. Capas densas para la estimación final
 */
export class GlucoseNeuralModel extends BaseNeuralModel {
  // Capas convolucionales para análisis espectral
  private conv1: Conv1DLayer;
  private bn1: BatchNormLayer;
  private conv2: Conv1DLayer;
  private bn2: BatchNormLayer;
  
  // Capa LSTM para análisis temporal
  private lstm: LSTMLayer;
  
  // Mecanismo de atención
  private attention: AttentionLayer;
  
  // Capas densas para estimación
  private dense1: DenseLayer;
  private dense2: DenseLayer;
  private outputLayer: DenseLayer;
  
  // Importancia de diferentes características
  private featureWeights: number[] = [0.4, 0.25, 0.2, 0.15]; // Espectral, temporal, morfológico, perfusión
  
  constructor() {
    super(
      'GlucoseNeuralModel',
      [450], // 7.5 segundos @ 60Hz - ventana más larga para mejor análisis espectral
      [1],   // Salida: nivel de glucosa (mg/dL)
      '1.5.0'
    );
    
    // Inicializar capas
    this.conv1 = new Conv1DLayer(1, 24, 15, 1, 'relu');
    this.bn1 = new BatchNormLayer(24);
    this.conv2 = new Conv1DLayer(24, 48, 9, 1, 'relu');
    this.bn2 = new BatchNormLayer(48);
    
    // LSTM para análisis temporal
    this.lstm = new LSTMLayer(48, 32);
    
    // Mecanismo de atención para enfocarse en regiones informativas
    this.attention = new AttentionLayer(32, 8);
    
    // Capas densas para estimación final
    this.dense1 = new DenseLayer(32, 28, undefined, undefined, 'relu');
    this.dense2 = new DenseLayer(28, 14, undefined, undefined, 'relu');
    this.outputLayer = new DenseLayer(14, 1, undefined, undefined, 'linear');
  }
  
  /**
   * Predice el nivel de glucosa basado en la señal PPG
   * @param input Señal PPG
   * @returns Nivel de glucosa (mg/dL) o null si ocurre un error
   */
  predict(input: Tensor1D): Tensor1D | null {
    // Chequeo de inicialización de TensorFlow y OpenCV
    if (typeof window !== 'undefined') {
      if (!window.cv) {
        console.error('[GlucoseNeuralModel] OpenCV no está inicializado.');
        throw new Error('OpenCV debe estar inicializado para medir.');
      }
    }
    if (!tf || !tf.ready) {
      console.error('[GlucoseNeuralModel] TensorFlow no está inicializado.');
      throw new Error('TensorFlow debe estar inicializado para medir.');
    }
    const startTime = Date.now();
    try {
      console.log('[GlucoseNeuralModel] Preprocesando entrada...');
      const processedInput = this.preprocessInput(input);
      
      // Forward pass - extracción de características
      let x = this.conv1.forward([processedInput]);
      x = this.bn1.forward(x);
      x = this.conv2.forward(x);
      x = this.bn2.forward(x);
      
      // Preparar para LSTM
      const sequenceLength = x[0].length;
      const featureCount = x.length;
      const lstmInput: Tensor1D[] = [];
      
      for (let i = 0; i < sequenceLength; i++) {
        const timeStep: Tensor1D = [];
        for (let f = 0; f < featureCount; f++) {
          timeStep.push(x[f][i]);
        }
        lstmInput.push(timeStep);
      }
      
      // LSTM
      const lstmOutput = this.lstm.forward(lstmInput);
      
      // Atención para enfocarse en características relevantes
      const attentionOutput = this.attention.forward([lstmOutput.finalState.h]);
      
      // Capas densas para estimación final
      let output = this.dense1.forward(attentionOutput[0]);
      output = this.dense2.forward(output);
      output = this.outputLayer.forward(output);
      
      // Extraer características adicionales para refinamiento
      const morphologicalFeatures = this.extractMorphologicalFeatures(processedInput);
      const spectralFeatures = this.extractSpectralFeatures(processedInput);
      
      // Combinar con características específicas para glucosa
      const baseGlucose = 95 + output[0]; // Línea base + ajuste del modelo
      
      // Ajustar a rango fisiológico normal (70-180 mg/dL) con ajustes morfológicos
      let glucose = baseGlucose;
      glucose += morphologicalFeatures.riseFallRatio * 5;
      glucose += spectralFeatures.highFrequencyRatio * -8;
      glucose += spectralFeatures.lowFrequencyRatio * 10;
      
      // Asegurar límites fisiológicos
      glucose = Math.max(70, Math.min(180, glucose));
      
      this.updatePredictionTime(startTime);
      console.log('[GlucoseNeuralModel] Predicción final:', glucose);
      return [Math.round(glucose)];
    } catch (error) {
      console.error('[GlucoseNeuralModel] Error en predict:', error);
      this.updatePredictionTime(startTime);
      return null;
    }
  }
  
  /**
   * Preprocesamiento específico para señales de glucosa
   */
  private preprocessInput(input: Tensor1D): Tensor1D {
    // Ajustar longitud
    if (input.length < this.inputShape[0]) {
      // Rellenar con reflejos de la señal para evitar discontinuidades
      const padding = [];
      for (let i = 0; i < this.inputShape[0] - input.length; i++) {
        padding.push(input[input.length - 1 - (i % input.length)]);
      }
      input = [...input, ...padding];
    } else if (input.length > this.inputShape[0]) {
      input = input.slice(-this.inputShape[0]);
    }
    
    // Aplicar filtro paso banda específico para componentes relacionados con glucosa
    let processed = this.bandpassFilter(input, 0.5, 4.0);
    
    // Normalizar
    processed = TensorUtils.standardizeSignal(processed);
    
    // Eliminar tendencia
    const trend = this.calculateTrend(processed);
    for (let i = 0; i < processed.length; i++) {
      processed[i] -= trend[i];
    }
    
    return processed;
  }
  
  /**
   * Calcula la línea de tendencia de la señal
   */
  private calculateTrend(signal: Tensor1D): Tensor1D {
    // Enfoque simplificado: promedio móvil de ventana grande
    const windowSize = Math.floor(signal.length / 4);
    const trend: Tensor1D = [];
    
    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(signal.length - 1, i + windowSize); j++) {
        sum += signal[j];
        count++;
      }
      
      trend.push(sum / count);
    }
    
    return trend;
  }
  
  /**
   * Filtro paso banda simplificado
   */
  private bandpassFilter(signal: Tensor1D, lowFreq: number, highFreq: number): Tensor1D {
    // Implementación simplificada de un filtro IIR Butterworth
    const fs = 60; // Frecuencia de muestreo estimada
    const lowCutoff = lowFreq / (fs / 2);
    const highCutoff = highFreq / (fs / 2);
    
    // Coeficientes Butterworth de segundo orden
    const a1 = -1.8 * Math.cos(Math.PI * (lowCutoff + highCutoff)) / 
               (1 + Math.sin(Math.PI * (lowCutoff + highCutoff)));
    const a2 = (1 - Math.sin(Math.PI * (lowCutoff + highCutoff))) / 
               (1 + Math.sin(Math.PI * (lowCutoff + highCutoff)));
    const b0 = (1 - Math.cos(Math.PI * (highCutoff - lowCutoff))) / 2;
    const b1 = 0;
    const b2 = -(1 - Math.cos(Math.PI * (highCutoff - lowCutoff))) / 2;
    
    // Aplicar filtro
    const result: Tensor1D = [];
    let x1 = 0, x2 = 0;
    let y1 = 0, y2 = 0;
    
    for (let i = 0; i < signal.length; i++) {
      const x0 = signal[i];
      const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      
      result.push(y0);
      
      x2 = x1;
      x1 = x0;
      y2 = y1;
      y1 = y0;
    }
    
    return result;
  }
  
  /**
   * Extrae características morfológicas de la forma de onda
   */
  private extractMorphologicalFeatures(signal: Tensor1D): {
    riseFallRatio: number;
    dicroticNotchHeight: number;
    peakValleyRatio: number;
    areaUnderCurve: number;
  } {
    // Detectar picos y valles
    const { peaks, valleys } = this.findPeaksAndValleys(signal);
    
    if (peaks.length < 2 || valleys.length < 2) {
      return {
        riseFallRatio: 1.0,
        dicroticNotchHeight: 0.1,
        peakValleyRatio: 1.2,
        areaUnderCurve: 0.5
      };
    }
    
    // Calcular tiempos de subida y bajada
    let avgRiseTime = 0;
    let avgFallTime = 0;
    
    for (let i = 0; i < Math.min(peaks.length, valleys.length) - 1; i++) {
      avgRiseTime += peaks[i] - valleys[i];
      avgFallTime += valleys[i+1] - peaks[i];
    }
    
    avgRiseTime /= Math.min(peaks.length, valleys.length) - 1;
    avgFallTime /= Math.min(peaks.length, valleys.length) - 1;
    
    const riseFallRatio = avgRiseTime / avgFallTime;
    
    // Calcular relación pico-valle
    let peakSum = 0;
    let valleySum = 0;
    
    for (const peakIdx of peaks) {
      peakSum += signal[peakIdx];
    }
    
    for (const valleyIdx of valleys) {
      valleySum += signal[valleyIdx];
    }
    
    const peakAvg = peakSum / peaks.length;
    const valleyAvg = valleySum / valleys.length;
    const peakValleyRatio = Math.abs(peakAvg / (valleyAvg || 0.001));
    
    // Buscar muesca dicrótica
    let dicroticNotchHeight = 0;
    
    for (let i = 0; i < peaks.length - 1; i++) {
      const start = peaks[i];
      const end = valleys[i+1] || signal.length - 1;
      
      if (end - start < 5) continue;
      
      // Buscar muesca dicrótica en la fase de descenso
      let minSecondDeriv = 0;
      let notchHeight = 0;
      
      for (let j = start + 2; j < end - 2; j++) {
        const secondDeriv = signal[j-2] - 2 * signal[j] + signal[j+2];
        
        if (secondDeriv < minSecondDeriv) {
          minSecondDeriv = secondDeriv;
          notchHeight = (signal[start] - signal[j]) / (signal[start] - signal[end]);
        }
      }
      
      dicroticNotchHeight += notchHeight;
    }
    
    dicroticNotchHeight /= peaks.length;
    
    // Calcular área bajo la curva
    let areaUnderCurve = 0;
    for (let i = 0; i < signal.length; i++) {
      areaUnderCurve += Math.max(0, signal[i]); // Solo área positiva
    }
    areaUnderCurve /= signal.length;
    
    return {
      riseFallRatio,
      dicroticNotchHeight,
      peakValleyRatio,
      areaUnderCurve
    };
  }
  
  /**
   * Extrae características espectrales
   */
  private extractSpectralFeatures(signal: Tensor1D): {
    highFrequencyRatio: number;
    lowFrequencyRatio: number;
    dominantFrequency: number;
    spectralEntropy: number;
  } {
    // Aplicar ventana Hamming
    const windowedSignal = signal.map((val, i) => 
      val * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (signal.length - 1)))
    );
    
    // Calcular FFT (simplificada)
    const fftSize = this.nextPowerOf2(signal.length);
    const paddedSignal = [...windowedSignal];
    while (paddedSignal.length < fftSize) {
      paddedSignal.push(0);
    }
    
    // Implementación DFT simplificada
    const real: number[] = [];
    const imag: number[] = [];
    const N = paddedSignal.length;
    
    for (let k = 0; k < N / 2; k++) {
      let re = 0;
      let im = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        re += paddedSignal[n] * Math.cos(angle);
        im += paddedSignal[n] * Math.sin(angle);
      }
      
      real.push(re);
      imag.push(im);
    }
    
    // Calcular magnitud
    const magnitudes: number[] = [];
    for (let i = 0; i < real.length; i++) {
      magnitudes.push(Math.sqrt(real[i] * real[i] + imag[i] * imag[i]));
    }
    
    // Ignorar componente DC
    magnitudes[0] = 0;
    
    // Definir bandas de frecuencia
    const fs = 60; // frecuencia de muestreo estimada
    const binWidth = fs / N;
    
    const veryLowBand = [0.01, 0.04]; // 0.01-0.04 Hz
    const lowBand = [0.04, 0.15];     // 0.04-0.15 Hz
    const highBand = [0.15, 0.4];     // 0.15-0.4 Hz
    const veryHighBand = [0.4, 2.0];  // 0.4-2.0 Hz
    
    // Calcular potencia en bandas
    let veryLowPower = 0;
    let lowPower = 0;
    let highPower = 0;
    let veryHighPower = 0;
    let totalPower = 0;
    
    let maxPower = 0;
    let dominantBin = 0;
    
    for (let i = 1; i < magnitudes.length; i++) {
      const freq = i * binWidth;
      const power = magnitudes[i] * magnitudes[i];
      
      if (power > maxPower) {
        maxPower = power;
        dominantBin = i;
      }
      
      if (freq >= veryLowBand[0] && freq < veryLowBand[1]) {
        veryLowPower += power;
      } else if (freq >= lowBand[0] && freq < lowBand[1]) {
        lowPower += power;
      } else if (freq >= highBand[0] && freq < highBand[1]) {
        highPower += power;
      } else if (freq >= veryHighBand[0] && freq < veryHighBand[1]) {
        veryHighPower += power;
      }
      
      totalPower += power;
    }
    
    // Normalizar potencias
    veryLowPower = veryLowPower / (totalPower || 1);
    lowPower = lowPower / (totalPower || 1);
    highPower = highPower / (totalPower || 1);
    veryHighPower = veryHighPower / (totalPower || 1);
    
    // Calcular ratios relevantes para glucosa
    const lowFrequencyRatio = (veryLowPower + lowPower) / (totalPower || 1);
    const highFrequencyRatio = (highPower + veryHighPower) / (totalPower || 1);
    
    // Calcular entropía espectral
    let spectralEntropy = 0;
    for (let i = 1; i < magnitudes.length; i++) {
      const normalizedPower = magnitudes[i] * magnitudes[i] / (totalPower || 1);
      if (normalizedPower > 0) {
        spectralEntropy -= normalizedPower * Math.log2(normalizedPower);
      }
    }
    spectralEntropy /= Math.log2(magnitudes.length);
    
    // Frecuencia dominante
    const dominantFrequency = dominantBin * binWidth;
    
    return {
      highFrequencyRatio,
      lowFrequencyRatio,
      dominantFrequency,
      spectralEntropy
    };
  }
  
  /**
   * Encuentra picos y valles en la señal
   */
  private findPeaksAndValleys(signal: Tensor1D): { peaks: number[]; valleys: number[] } {
    const peaks: number[] = [];
    const valleys: number[] = [];
    const minDistance = 10; // Mínima distancia entre picos
    
    // Detectar picos y valles
    for (let i = 1; i < signal.length - 1; i++) {
      // Es un pico
      if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
        if (peaks.length === 0 || i - peaks[peaks.length-1] >= minDistance) {
          peaks.push(i);
        } else if (signal[i] > signal[peaks[peaks.length-1]]) {
          peaks[peaks.length-1] = i; // Reemplazar con pico más alto
        }
      }
      
      // Es un valle
      if (signal[i] < signal[i-1] && signal[i] < signal[i+1]) {
        if (valleys.length === 0 || i - valleys[valleys.length-1] >= minDistance) {
          valleys.push(i);
        } else if (signal[i] < signal[valleys[valleys.length-1]]) {
          valleys[valleys.length-1] = i; // Reemplazar con valle más bajo
        }
      }
    }
    
    return { peaks, valleys };
  }
  
  private nextPowerOf2(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }
  
  get parameterCount(): number {
    let count = 0;
    
    // Conv layers
    count += (15 * 1 * 24) + 24;
    count += (9 * 24 * 48) + 48;
    
    // LSTM
    count += 4 * ((48 * 32) + (32 * 32) + 32);
    
    // Attention
    count += 32 * 8 * 3; // Query, Key, Value matrices
    
    // Dense layers
    count += (32 * 28) + 28;
    count += (28 * 14) + 14;
    count += (14 * 1) + 1;
    
    return count;
  }
  
  get architecture(): string {
    return `CNN-LSTM-Attention (${this.parameterCount} params)`;
  }
}

