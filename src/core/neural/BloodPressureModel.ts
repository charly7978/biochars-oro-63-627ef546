
import { BaseNeuralModel, DenseLayer, Conv1DLayer, ResidualBlock, BatchNormLayer, TensorUtils, Tensor1D } from './NeuralNetworkBase';

/**
 * Modelo neuronal especializado en la estimación de presión arterial
 * 
 * IMPORTANTE: Este modelo solo trabaja con datos reales, sin simulación.
 * NO utiliza Math.random() ni ninguna función que genere datos aleatorios.
 */
export class BloodPressureNeuralModel extends BaseNeuralModel {
  // Capas
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
      '3.0.0' // Incrementada versión para indicar eliminación de simulación
    );
    
    // Feature extraction layers
    this.conv1 = new Conv1DLayer(1, 32, 15, 1, 'relu');
    this.bn1 = new BatchNormLayer(32);
    
    // Residual blocks
    this.residualBlock1 = new ResidualBlock(32, 7);
    this.residualBlock2 = new ResidualBlock(32, 5);
    
    // Systolic branch
    this.systolicBranch1 = new DenseLayer(32, 24, undefined, undefined, 'relu');
    this.systolicBranch2 = new DenseLayer(24, 12, undefined, undefined, 'relu');
    this.systolicOutput = new DenseLayer(12, 1, undefined, undefined, 'linear');
    
    // Diastolic branch
    this.diastolicBranch1 = new DenseLayer(32, 24, undefined, undefined, 'relu');
    this.diastolicBranch2 = new DenseLayer(24, 12, undefined, undefined, 'relu');
    this.diastolicOutput = new DenseLayer(12, 1, undefined, undefined, 'linear');
  }
  
  /**
   * Predice presión arterial sistólica y diastólica
   * SOLO procesa datos reales, sin simulación
   * @param input Señal PPG
   * @returns [sistólica, diastólica] en mmHg, o [0,0] si no hay estimación confiable
   */
  predict(input: Tensor1D): Tensor1D {
    const startTime = Date.now();
    
    try {
      // Verificar datos de entrada
      if (!input || input.length === 0) {
        console.error('BloodPressureNeuralModel: Datos de entrada inválidos');
        return [0, 0]; // Indicar que no hay medición
      }
      
      // Preprocesar entrada
      const processedInput = this.preprocessInput(input);
      
      // Forward pass - extracción de características
      let features = this.conv1.forward([processedInput]);
      features = this.bn1.forward(features);
      
      // Blocks residuales
      features = this.residualBlock1.forward(features);
      features = this.residualBlock2.forward(features);
      
      // Global average pooling
      const pooled = this.globalAveragePooling(features);
      
      // Rama sistólica
      let systolicOut = this.systolicBranch1.forward(pooled);
      systolicOut = this.systolicBranch2.forward(systolicOut);
      systolicOut = this.systolicOutput.forward(systolicOut);
      
      // Rama diastólica
      let diastolicOut = this.diastolicBranch1.forward(pooled);
      diastolicOut = this.diastolicBranch2.forward(diastolicOut);
      diastolicOut = this.diastolicOutput.forward(diastolicOut);
      
      // Verificar si los resultados son fisiológicamente válidos
      const systolic = systolicOut[0];
      const diastolic = diastolicOut[0];
      
      // Verificar si los resultados parecen válidos para publicar
      if (isNaN(systolic) || isNaN(diastolic) || systolic <= 0 || diastolic <= 0) {
        console.error('BloodPressureNeuralModel: Resultados inválidos', { systolic, diastolic });
        return [0, 0]; // Indicar que no hay medición
      }
      
      // Verificar que la sistólica es mayor que la diastólica
      if (systolic <= diastolic) {
        console.error('BloodPressureNeuralModel: Relación inválida entre sistólica y diastólica', { 
          systolic, diastolic 
        });
        return [0, 0]; // Indicar que no hay medición
      }
      
      this.updatePredictionTime(startTime);
      
      // Redondear a enteros para consistencia
      return [Math.round(systolic), Math.round(diastolic)];
    } catch (error) {
      console.error('Error en BloodPressureNeuralModel.predict:', error);
      this.updatePredictionTime(startTime);
      return [0, 0]; // Indicar que no hay medición en caso de error
    }
  }
  
  /**
   * Preprocesa la señal para análisis de presión arterial
   * Solo aplica filtrado y normalización, sin manipulación
   */
  private preprocessInput(input: Tensor1D): Tensor1D {
    // Ajustar longitud
    let processedInput: Tensor1D;
    if (input.length < this.inputShape[0]) {
      // Padding con ceros si es más corta
      processedInput = [...input];
      for (let i = input.length; i < this.inputShape[0]; i++) {
        processedInput.push(0);
      }
    } else if (input.length > this.inputShape[0]) {
      // Tomar solo la parte final si es más larga
      processedInput = input.slice(-this.inputShape[0]);
    } else {
      processedInput = [...input];
    }
    
    // Aplicar filtro
    processedInput = this.bandpassFilter(processedInput);
    
    // Normalizar si hay un rango significativo
    const { min, max } = this.findMinMax(processedInput);
    const range = max - min;
    
    if (range > 0.001) { // Solo normalizar si hay un rango significativo
      for (let i = 0; i < processedInput.length; i++) {
        processedInput[i] = (processedInput[i] - min) / range;
      }
    } else {
      // Si no hay rango, centrar en cero
      for (let i = 0; i < processedInput.length; i++) {
        processedInput[i] = 0;
      }
    }
    
    return processedInput;
  }
  
  /**
   * Aplica un filtro paso banda simplificado
   */
  private bandpassFilter(signal: Tensor1D): Tensor1D {
    // Aplicar promedio móvil para filtro paso bajo
    const lpfWindow = 5;
    const lpfSignal = this.movingAverage(signal, lpfWindow);
    
    // Aplicar derivador para filtro paso alto
    const hpfSignal: Tensor1D = [];
    for (let i = 0; i < signal.length; i++) {
      hpfSignal.push(signal[i] - 0.95 * (lpfSignal[i] || 0));
    }
    
    return hpfSignal;
  }
  
  /**
   * Implementa promedio móvil
   */
  private movingAverage(signal: Tensor1D, window: number): Tensor1D {
    const result: Tensor1D = [];
    
    for (let i = 0; i < signal.length; i++) {
      let sum = 0;
      let count = 0;
      
      // Índice inicial del promedio móvil
      let startIdx = i - window;
      if (startIdx < 0) startIdx = 0;
      
      // Índice final del promedio móvil
      let endIdx = i + window;
      if (endIdx >= signal.length) endIdx = signal.length - 1;
      
      // Calcular promedio
      for (let j = startIdx; j <= endIdx; j++) {
        sum += signal[j];
        count++;
      }
      
      result.push(sum / count);
    }
    
    return result;
  }
  
  /**
   * Encuentra valores mínimo y máximo en un array
   */
  private findMinMax(array: Tensor1D): { min: number; max: number } {
    if (!array || array.length === 0) return { min: 0, max: 0 };
    
    let min = array[0];
    let max = array[0];
    
    for (let i = 1; i < array.length; i++) {
      if (array[i] < min) min = array[i];
      if (array[i] > max) max = array[i];
    }
    
    return { min, max };
  }
  
  /**
   * Global average pooling implementation
   */
  private globalAveragePooling(features: Tensor1D[]): Tensor1D {
    const result: Tensor1D = [];
    
    for (let f = 0; f < features.length; f++) {
      const sum = features[f].reduce((acc, val) => acc + val, 0);
      result.push(sum / features[f].length);
    }
    
    return result;
  }
  
  get parameterCount(): number {
    let count = 0;
    
    // Conv layers
    count += (15 * 1 * 32) + 32;
    
    // Residual blocks
    count += 2 * ((7 * 32 * 32) + 32 + (7 * 32 * 32) + 32);
    
    // Dense layers - systolic
    count += (32 * 24) + 24;
    count += (24 * 12) + 12;
    count += (12 * 1) + 1;
    
    // Dense layers - diastolic
    count += (32 * 24) + 24;
    count += (24 * 12) + 12;
    count += (12 * 1) + 1;
    
    return count;
  }
  
  get architecture(): string {
    return `CNN-ResNet-Dual (${this.parameterCount} params)`;
  }
}
