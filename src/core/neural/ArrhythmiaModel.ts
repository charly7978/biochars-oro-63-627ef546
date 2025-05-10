
import { 
  BaseNeuralModel, 
  DenseLayer, 
  Conv1DLayer, 
  LSTMLayer,
  BatchNormLayer,
  TensorUtils,
  Tensor1D 
} from './NeuralNetworkBase';

/**
 * Modelo neuronal para detección de arritmias cardíacas
 * 
 * Arquitectura:
 * 1. Capas convolucionales para reconocimiento de patrones
 * 2. LSTM para análisis de secuencias temporales anómalas
 * 3. Clasificador denso para detección de arritmia
 */
export class ArrhythmiaNeuralModel extends BaseNeuralModel {
  // Extracción de características
  private conv1: Conv1DLayer;
  private bn1: BatchNormLayer;
  private conv2: Conv1DLayer;
  private bn2: BatchNormLayer;
  
  // Análisis de secuencia temporal
  private lstm: LSTMLayer;
  
  // Clasificación
  private dense1: DenseLayer;
  private dense2: DenseLayer;
  private outputLayer: DenseLayer;
  
  constructor() {
    super(
      'ArrhythmiaNeuralModel',
      [300], // 5 segundos @ 60Hz
      [1],   // Salida: probabilidad de arritmia
      '1.3.0'
    );
    
    // Inicializar capas
    this.conv1 = new Conv1DLayer(1, 16, 9, 1, 'relu');
    this.bn1 = new BatchNormLayer(16);
    this.conv2 = new Conv1DLayer(16, 32, 5, 1, 'relu');
    this.bn2 = new BatchNormLayer(32);
    
    // LSTM para secuencias
    this.lstm = new LSTMLayer(32, 24);
    
    // Clasificación
    this.dense1 = new DenseLayer(24, 16, undefined, undefined, 'relu');
    this.dense2 = new DenseLayer(16, 8, undefined, undefined, 'relu');
    this.outputLayer = new DenseLayer(8, 1, undefined, undefined, 'sigmoid');
  }
  
  /**
   * Predice la probabilidad de arritmia
   * @param input Señal PPG
   * @returns Probabilidad de arritmia [0-1]
   */
  predict(input: Tensor1D): Tensor1D {
    const startTime = Date.now();
    
    try {
      // Preprocesamiento
      const processedInput = this.preprocessInput(input);
      
      // Forward pass
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
      
      // Clasificación
      let output = this.dense1.forward(lstmOutput.finalState.h);
      output = this.dense2.forward(output);
      output = this.outputLayer.forward(output);
      
      // Aplicar análisis de variabilidad adicional
      const rrMetrics = this.analyzeRRVariability(processedInput);
      
      // Combinar salida neural con análisis RR
      const combinedProb = (output[0] * 0.7) + (rrMetrics.normalizedRMSSD * 0.3);
      
      // Umbral de decisión adaptativo
      const threshold = 0.65 - (rrMetrics.normalizedRMSSD * 0.15);
      
      this.updatePredictionTime(startTime);
      return [combinedProb];
    } catch (error) {
      console.error('Error en ArrhythmiaNeuralModel.predict:', error);
      this.updatePredictionTime(startTime);
      return [0.1]; // Valor bajo por defecto
    }
  }
  
  /**
   * Preprocesa la entrada para análisis de arritmias
   */
  private preprocessInput(input: Tensor1D): Tensor1D {
    // Ajustar longitud
    if (input.length < this.inputShape[0]) {
      const padding = Array(this.inputShape[0] - input.length).fill(0);
      input = [...input, ...padding];
    } else if (input.length > this.inputShape[0]) {
      input = input.slice(-this.inputShape[0]);
    }
    
    // Normalizar
    return TensorUtils.standardizeSignal(input);
  }
  
  /**
   * Analiza variabilidad de intervalos R-R
   */
  private analyzeRRVariability(signal: Tensor1D): {
    normalizedRMSSD: number;
    irregularityScore: number;
  } {
    // Detectar picos R
    const peaks = this.detectRPeaks(signal);
    
    // Calcular intervalos RR
    const rrIntervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      rrIntervals.push(peaks[i] - peaks[i-1]);
    }
    
    // Si no hay suficientes intervalos, devolver valores por defecto
    if (rrIntervals.length < 2) {
      return {
        normalizedRMSSD: 0.1,
        irregularityScore: 0.1
      };
    }
    
    // Calcular RMSSD
    let sumSquaredDiff = 0;
    for (let i = 1; i < rrIntervals.length; i++) {
      const diff = rrIntervals[i] - rrIntervals[i-1];
      sumSquaredDiff += diff * diff;
    }
    const rmssd = Math.sqrt(sumSquaredDiff / (rrIntervals.length - 1));
    
    // Calcular pNN50
    let nn50Count = 0;
    for (let i = 1; i < rrIntervals.length; i++) {
      if (Math.abs(rrIntervals[i] - rrIntervals[i-1]) > 50) {
        nn50Count++;
      }
    }
    const pnn50 = nn50Count / (rrIntervals.length - 1);
    
    // Normalizar RMSSD (valores típicos 10-50ms)
    const normalizedRMSSD = Math.min(1, rmssd / 50);
    
    // Calcular irregularidad
    const meanRR = rrIntervals.reduce((sum, val) => sum + val, 0) / rrIntervals.length;
    let irregularityScore = 0;
    for (const interval of rrIntervals) {
      irregularityScore += Math.abs(interval - meanRR) / meanRR;
    }
    irregularityScore /= rrIntervals.length;
    irregularityScore = Math.min(1, irregularityScore * 3);
    
    return {
      normalizedRMSSD,
      irregularityScore
    };
  }
  
  /**
   * Detecta picos R en la señal
   */
  private detectRPeaks(signal: Tensor1D): number[] {
    const peaks: number[] = [];
    const minDistance = 20; // Mínima distancia entre picos (en muestras)
    
    // Calcular derivada
    const derivative: number[] = [];
    for (let i = 1; i < signal.length; i++) {
      derivative.push(signal[i] - signal[i-1]);
    }
    
    // Detectar cruces por cero de negativo a positivo
    let lastPeak = -minDistance;
    for (let i = 1; i < derivative.length; i++) {
      if (derivative[i-1] < 0 && derivative[i] >= 0) {
        // Posible pico R
        if (i - lastPeak >= minDistance) {
          // Verificar que hay suficiente amplitud
          const peakHeight = signal[i] - signal[Math.max(0, i-5)];
          if (peakHeight > 0.2) {
            peaks.push(i);
            lastPeak = i;
          }
        }
      }
    }
    
    return peaks;
  }
  
  get parameterCount(): number {
    let count = 0;
    
    // Conv layers
    count += (9 * 1 * 16) + 16;
    count += (5 * 16 * 32) + 32;
    
    // LSTM
    count += 4 * ((32 * 24) + (24 * 24) + 24);
    
    // Dense layers
    count += (24 * 16) + 16;
    count += (16 * 8) + 8;
    count += (8 * 1) + 1;
    
    return count;
  }
  
  get architecture(): string {
    return `CNN-LSTM (${this.parameterCount} params)`;
  }
}
