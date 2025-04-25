import * as tf from '@tensorflow/tfjs';
import { findMaximum, findMinimum, absoluteValue, roundToInt, squareRoot } from '../../../utils/non-math-utils';

/**
 * Utilidades para adaptar tensores entre formatos
 */
export class TensorUtils {
  /**
   * Convierte un array de JavaScript a un tensor de TensorFlow
   */
  static preprocessForTensorFlow(input: number[], inputSize: number): tf.Tensor {
    // Asegurar que la entrada tiene el tamaño correcto
    let paddedInput = input;
    if (input.length < inputSize) {
      // Rellenar con ceros si es necesario
      paddedInput = [...input];
      while (paddedInput.length < inputSize) {
        paddedInput.push(0);
      }
    } else if (input.length > inputSize) {
      // Truncar si es necesario
      paddedInput = input.slice(0, inputSize);
    }
    
    // Convertir a tensor 2D [1, inputSize]
    return tf.tensor2d([paddedInput], [1, inputSize]);
  }
  
  /**
   * Convierte un array de JavaScript a un tensor 3D para redes convolucionales
   */
  static preprocessForConv1D(input: number[], inputSize: number): tf.Tensor {
    // Asegurar que la entrada tiene el tamaño correcto
    let paddedInput = input;
    if (input.length < inputSize) {
      // Rellenar con ceros si es necesario
      paddedInput = [...input];
      while (paddedInput.length < inputSize) {
        paddedInput.push(0);
      }
    } else if (input.length > inputSize) {
      // Truncar si es necesario
      paddedInput = input.slice(0, inputSize);
    }
    
    // Convertir a tensor 3D [1, inputSize, 1] para Conv1D
    return tf.tensor3d([paddedInput.map(v => [v])], [1, inputSize, 1]);
  }
  
  /**
   * Normaliza un tensor a un rango específico
   */
  static normalizeInput(input: number[], min: number = 0, max: number = 1): number[] {
    if (input.length === 0) return [];
    const minVal = findMinimum(input);
    const maxVal = findMaximum(input);
    if (maxVal === minVal) {
      return Array(input.length).fill((min + max) / 2);
    }
    return input.map(x => min + ((x - minVal) / (maxVal - minVal)) * (max - min));
  }
  
  /**
   * Aplica un filtro de media móvil
   */
  static movingAverage(input: number[], windowSize: number = 5): number[] {
    if (input.length <= windowSize) {
      return input;
    }
    const result = [];
    for (let i = 0; i < input.length; i++) {
      let sum = 0;
      let count = 0;
      // Calcular ventana
      for (let j = Math.max(0, i - Math.floor(windowSize / 2)); 
           j <= Math.min(input.length - 1, i + Math.floor(windowSize / 2)); j++) {
        sum += input[j];
        count++;
      }
      result.push(sum / count);
    }
    return result;
  }
  
  /**
   * Realiza zero-padding a un tensor
   */
  static padArray(input: number[], targetLength: number): number[] {
    if (input.length >= targetLength) {
      return input.slice(0, targetLength);
    }
    
    const padding = Array(targetLength - input.length).fill(0);
    return [...input, ...padding];
  }
  
  /**
   * Libera memoria de un tensor si existe
   */
  static disposeTensor(tensor: tf.Tensor | null): void {
    if (tensor && tensor.dispose) {
      tensor.dispose();
    }
  }
  
  /**
   * Obtiene las estadísticas de un array (media, min, max, std)
   */
  static getArrayStats(arr: number[]): { mean: number, min: number, max: number, std: number } {
    if (arr.length === 0) {
      return { mean: 0, min: 0, max: 0, std: 0 };
    }
    const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
    const min = findMinimum(arr);
    const max = findMaximum(arr);
    let variance = 0;
    for (let i = 0; i < arr.length; i++) {
      variance += (arr[i] - mean) * (arr[i] - mean);
    }
    variance = variance / arr.length;
    let std = squareRoot(variance);
    return { mean, min, max, std };
  }
}
