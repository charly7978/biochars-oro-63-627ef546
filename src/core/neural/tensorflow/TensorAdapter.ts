
import * as tf from '@tensorflow/tfjs';
import { Tensor1D } from '../NeuralNetworkBase';

/**
 * Utilidades para convertir entre nuestros tensores y los de TensorFlow.js
 */
export class TensorUtils {
  /**
   * Convierte un Tensor1D (array) a un tensor de TensorFlow
   */
  public static toTFTensor(tensor: Tensor1D, expandDims = true): tf.Tensor {
    // Crear tensor básico
    const tfTensor = tf.tensor1d(tensor);
    
    // Expandir dimensiones si es necesario
    if (expandDims) {
      // Añadir dimensión de batch y canal
      return tfTensor.expandDims(0).expandDims(-1);
    }
    
    return tfTensor;
  }
  
  /**
   * Convierte un tensor de TensorFlow a nuestro formato Tensor1D
   */
  public static fromTFTensor(tensor: tf.Tensor): Tensor1D {
    // Asegurar que tenemos un tensor 1D
    const t1d = tensor.squeeze();
    
    // Convertir a array JavaScript
    const arrayData = Array.from(t1d.dataSync() as Float32Array);
    
    // Limpiar tensor
    t1d.dispose();
    
    return arrayData;
  }
  
  /**
   * Normaliza un Tensor1D
   */
  public static normalizeSignal(signal: Tensor1D): Tensor1D {
    if (signal.length === 0) return [];
    
    // Convertir a tensor TF para operaciones vectorizadas
    const tfTensor = tf.tensor1d(signal);
    
    // Calcular media y desviación estándar
    const mean = tfTensor.mean();
    const std = tfTensor.sub(mean).square().mean().sqrt();
    
    // Normalizar a media=0, std=1
    const normalized = tfTensor.sub(mean).div(std.add(tf.scalar(1e-5)));
    
    // Convertir de vuelta a array
    const result = Array.from(normalized.dataSync() as Float32Array);
    
    // Limpiar tensores
    tfTensor.dispose();
    mean.dispose();
    std.dispose();
    normalized.dispose();
    
    return result;
  }
  
  /**
   * Estandariza un Tensor1D
   */
  public static standardizeSignal(signal: Tensor1D): Tensor1D {
    if (signal.length === 0) return [];
    
    // Convertir a tensor TF para operaciones vectorizadas
    const tfTensor = tf.tensor1d(signal);
    
    // Encontrar min y max
    const min = tfTensor.min();
    const max = tfTensor.max();
    
    // Normalizar a rango [0, 1]
    const normalized = tfTensor.sub(min).div(max.sub(min).add(tf.scalar(1e-5)));
    
    // Ajustar a rango [-1, 1]
    const standardized = normalized.mul(tf.scalar(2)).sub(tf.scalar(1));
    
    // Convertir de vuelta a array
    const result = Array.from(standardized.dataSync() as Float32Array);
    
    // Limpiar tensores
    tfTensor.dispose();
    min.dispose();
    max.dispose();
    normalized.dispose();
    standardized.dispose();
    
    return result;
  }
  
  /**
   * Aplica un filtro de paso bajo a un Tensor1D
   */
  public static lowPassFilter(signal: Tensor1D, cutoffFreq = 0.1): Tensor1D {
    if (signal.length < 3) return signal;
    
    // Implementar filtro IIR simple
    const alpha = cutoffFreq / (cutoffFreq + 1);
    const filtered: number[] = [signal[0]];
    
    for (let i = 1; i < signal.length; i++) {
      filtered.push(alpha * signal[i] + (1 - alpha) * filtered[i-1]);
    }
    
    return filtered;
  }
  
  /**
   * Aplica un filtro de paso alto a un Tensor1D
   */
  public static highPassFilter(signal: Tensor1D, cutoffFreq = 0.9): Tensor1D {
    if (signal.length < 3) return signal;
    
    // Aplicar filtro EMA y restar de la señal original
    const alpha = 1 - cutoffFreq;
    const ema: number[] = [signal[0]];
    
    for (let i = 1; i < signal.length; i++) {
      ema.push(alpha * signal[i] + (1 - alpha) * ema[i-1]);
    }
    
    return signal.map((val, i) => val - ema[i]);
  }
  
  /**
   * Detecta picos en un Tensor1D
   */
  public static findPeaks(signal: Tensor1D, minProminence = 0.1, minDistance = 10): number[] {
    if (signal.length < 3) return [];
    
    const peaks: number[] = [];
    
    for (let i = 1; i < signal.length - 1; i++) {
      // Comprobar si es un máximo local
      if (signal[i] > signal[i-1] && signal[i] > signal[i+1]) {
        // Calcular prominencia
        let leftMin = signal[i];
        for (let j = i-1; j >= Math.max(0, i-30); j--) {
          leftMin = Math.min(leftMin, signal[j]);
          if (signal[j] > signal[i]) break;
        }
        
        let rightMin = signal[i];
        for (let j = i+1; j < Math.min(signal.length, i+30); j++) {
          rightMin = Math.min(rightMin, signal[j]);
          if (signal[j] > signal[i]) break;
        }
        
        const prominence = signal[i] - Math.max(leftMin, rightMin);
        
        // Comprobar si cumple criterios
        if (prominence >= minProminence) {
          // Verificar distancia mínima con picos anteriores
          let isTooClose = false;
          for (const existingPeak of peaks) {
            if (Math.abs(existingPeak - i) < minDistance) {
              isTooClose = true;
              break;
            }
          }
          
          if (!isTooClose) {
            peaks.push(i);
          }
        }
      }
    }
    
    return peaks;
  }
}
