import { 
  BaseNeuralModel, 
  DenseLayer, 
  Conv1DLayer, 
  ResidualBlock,
  BatchNormLayer,
  TensorUtils,
  Tensor1D 
} from './NeuralNetworkBase';

/**
 * Modelo neuronal especializado en la estimación de presión arterial
 * 
 * Arquitectura:
 * 1. Capas convolucionales profundas para análisis de forma de onda
 * 2. Bloques residuales para mejorar el aprendizaje de características
 * 3. Salida dual para presión sistólica y diastólica
 */
export class BloodPressureNeuralModel extends BaseNeuralModel {
  // Layers
  private conv1: Conv1DLayer;
  private bn1: BatchNormLayer;
  private residualBlock1: ResidualBlock;
  private residualBlock2: ResidualBlock;
  
  // Ramas separadas para sistólica y diastólica
  private systolicBranch1: DenseLayer;
  private systolicBranch2: DenseLayer;
  private systolicOutput: DenseLayer;
  
  private diastolicBranch1: DenseLayer;
  private diastolicBranch2: DenseLayer;
  private diastolicOutput: DenseLayer;
  
  constructor() {
    super(
      'BloodPressureNeuralModel',
      [300], // 5 segundos de señal @ 60Hz
      [2],   // Salida: [sistólica, diastólica] en mmHg
      '2.2.0' // Updated version for increased sensitivity
    );
    
    // Enhanced feature extraction layers
    this.conv1 = new Conv1DLayer(1, 32, 11, 1, 'relu'); // Reduced kernel size from 15 to 11 for more sensitivity
    this.bn1 = new BatchNormLayer(32);
    
    // Optimized residual blocks
    this.residualBlock1 = new ResidualBlock(32, 7);
    this.residualBlock2 = new ResidualBlock(32, 5);
    
    // Enhanced systolic branch
    this.systolicBranch1 = new DenseLayer(32, 28, undefined, undefined, 'relu'); // Increased from 24 to 28
    this.systolicBranch2 = new DenseLayer(28, 14, undefined, undefined, 'relu'); // Increased from 12 to 14
    this.systolicOutput = new DenseLayer(14, 1, undefined, undefined, 'linear');
    
    // Enhanced diastolic branch
    this.diastolicBranch1 = new DenseLayer(32, 28, undefined, undefined, 'relu'); // Increased from 24 to 28
    this.diastolicBranch2 = new DenseLayer(28, 14, undefined, undefined, 'relu'); // Increased from 12 to 14
    this.diastolicOutput = new DenseLayer(14, 1, undefined, undefined, 'linear');
  }
  
  /**
   * Predice presión arterial sistólica y diastólica
   * @param input Señal PPG
   * @returns [sistólica, diastólica] en mmHg
   */
  predict(input: Tensor1D): Tensor1D {
    const startTime = Date.now();
    
    try {
      // Preprocesar entrada con mayor sensibilidad
      const processedInput = this.preprocessInput(input);
      
      // Forward pass - extracción de características
      let features = this.conv1.forward([processedInput]);
      features = this.bn1.forward(features);
      
      // Blocks residuales
      features = this.residualBlock1.forward(features);
      features = this.residualBlock2.forward(features);
      
      // Global average pooling con preservación de características
      const pooled = this.globalAveragePooling(features);
      
      // Rama sistólica
      let systolicOut = this.systolicBranch1.forward(pooled);
      systolicOut = this.systolicBranch2.forward(systolicOut);
      systolicOut = this.systolicOutput.forward(systolicOut);
      
      // Rama diastólica
      let diastolicOut = this.diastolicBranch1.forward(pooled);
      diastolicOut = this.diastolicBranch2.forward(diastolicOut);
      diastolicOut = this.diastolicOutput.forward(diastolicOut);
      
      // Aplicar restricciones fisiológicas con rango más amplio
      // Sistólica: 85-185 mmHg (ampliado desde 90-180)
      const systolic = Math.max(85, Math.min(185, 115 + systolicOut[0] * 1.1)); // Added multiplier for sensitivity
      
      // Diastólica: 55-115 mmHg (ampliado desde 60-110)
      const diastolic = Math.max(55, Math.min(115, 75 + diastolicOut[0] * 1.1)); // Added multiplier for sensitivity
      
      // Asegurar que sistólica > diastólica por al menos 20 mmHg
      const adjustedDiastolic = Math.min(diastolic, systolic - 20);
      
      this.updatePredictionTime(startTime);
      return [Math.round(systolic), Math.round(adjustedDiastolic)];
    } catch (error) {
      console.error('Error en BloodPressureNeuralModel.predict:', error);
      this.updatePredictionTime(startTime);
      return [120, 80]; // Valores por defecto
    }
  }
  
  /**
   * Preprocesa la señal para análisis de presión arterial
   * con mayor sensibilidad a cambios sutiles
   */
  private preprocessInput(input: Tensor1D): Tensor1D {
    // Ajustar longitud
    if (input.length < this.inputShape[0]) {
      // Duplicate signal for small inputs instead of zero padding
      const repeats = Math.ceil(this.inputShape[0] / input.length);
      let repeated: number[] = [];
      for (let i = 0; i < repeats; i++) {
        repeated = [...repeated, ...input];
      }
      input = repeated.slice(0, this.inputShape[0]);
    } else if (input.length > this.inputShape[0]) {
      input = input.slice(-this.inputShape[0]);
    }
    
    // Aplicar filtro mejorado
    let processed = this.enhancedBandpassFilter(input);
    
    // Normalizar con amplificación
    const { min, max } = this.findMinMax(processed);
    if (max > min) {
      // Apply enhanced normalization with slight amplification of variations
      processed = processed.map(v => {
        const normalized = (v - min) / (max - min);
        // Enhance small variations for better sensitivity
        return 0.5 + (normalized - 0.5) * 1.15; // Amplify deviations from mean
      });
    }
    
    return processed;
  }
  
  /**
   * Aplica un filtro paso banda mejorado para mayor sensibilidad
   */
  private enhancedBandpassFilter(signal: Tensor1D): Tensor1D {
    // Aplicar promedio móvil ponderado para filtro paso bajo
    const lpfSignal = this.weightedMovingAverage(signal, 5);
    
    // Aplicar derivador para filtro paso alto con menor atenuación
    const hpfSignal: Tensor1D = [];
    for (let i = 0; i < signal.length; i++) {
      // Reduced attenuation factor from 0.95 to 0.90 for higher sensitivity
      hpfSignal.push(signal[i] - 0.90 * (lpfSignal[i] || 0));
    }
    
    return hpfSignal;
  }
  
  /**
   * Implementa promedio móvil ponderado para mayor precisión
   */
  private weightedMovingAverage(signal: Tensor1D, window: number): Tensor1D {
    const result: Tensor1D = [];
    
    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      let weightSum = 0;
      
      for (let j = Math.max(0, i - window); j <= Math.min(signal.length - 1, i + window); j++) {
        // Apply higher weights to values closer to center
        const weight = 1 - Math.abs(i - j) / (window + 1);
        sum += signal[j] * weight;
        weightSum += weight;
      }
      
      result.push(sum / weightSum);
    }
    
    return result;
  }
  
  /**
   * Find min and max values in an array
   */
  private findMinMax(array: Tensor1D): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    
    for (const value of array) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
    
    return { min, max };
  }
  
  /**
   * Enhanced global average pooling with sensitivity to feature importance
   */
  private globalAveragePooling(features: Tensor1D[]): Tensor1D {
    const result: Tensor1D = [];
    
    for (let f = 0; f < features.length; f++) {
      // Enhanced pooling that gives more weight to stronger activations
      const values = features[f];
      const { min, max } = this.findMinMax(values);
      const range = max - min;
      
      if (range > 0) {
        // Weighted average giving more importance to higher values
        let weightedSum = 0;
        let weightSum = 0;
        
        for (const val of values) {
          // Normalize value and use as weight
          const normalized = (val - min) / range;
          const weight = 1 + normalized; // Values from 1 to 2 based on strength
          
          weightedSum += val * weight;
          weightSum += weight;
        }
        
        result.push(weightedSum / weightSum);
      } else {
        // If all values are the same, use simple average
        result.push(values.reduce((acc, val) => acc + val, 0) / values.length);
      }
    }
    
    return result;
  }
  
  get parameterCount(): number {
    let count = 0;
    
    // Conv layers
    count += (11 * 1 * 32) + 32;
    
    // Residual blocks
    count += 2 * ((7 * 32 * 32) + 32 + (7 * 32 * 32) + 32);
    
    // Dense layers - systolic
    count += (32 * 28) + 28;
    count += (28 * 14) + 14;
    count += (14 * 1) + 1;
    
    // Dense layers - diastolic
    count += (32 * 28) + 28;
    count += (28 * 14) + 14;
    count += (14 * 1) + 1;
    
    return count;
  }
  
  get architecture(): string {
    return `Enhanced CNN-ResNet-Dual (${this.parameterCount} params)`;
  }
}
