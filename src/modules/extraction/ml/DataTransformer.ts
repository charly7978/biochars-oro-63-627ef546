
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Transformador de datos para el procesador ML
 * Convierte entre arrays de JavaScript y tensores TensorFlow.js
 */
import * as tf from '@tensorflow/tfjs';

/**
 * Clase para transformación eficiente de datos
 */
export class DataTransformer {
  // Tamaño de ventana para procesamiento
  private windowSize: number;
  // Factor de superposición entre ventanas
  private overlapFactor: number;
  // Usar buffers preasignados para evitar reasignaciones
  private usePreallocatedBuffers: boolean;
  // Buffers preasignados
  private inputBuffer: Float32Array | null = null;
  private outputBuffer: Float32Array | null = null;
  
  constructor(
    windowSize: number = 30,
    overlapFactor: number = 0.5,
    usePreallocatedBuffers: boolean = true
  ) {
    this.windowSize = windowSize;
    this.overlapFactor = Math.max(0, Math.min(0.9, overlapFactor));
    this.usePreallocatedBuffers = usePreallocatedBuffers;
    
    if (this.usePreallocatedBuffers) {
      this.inputBuffer = new Float32Array(windowSize);
      this.outputBuffer = new Float32Array(windowSize);
    }
    
    console.log("DataTransformer: Inicializado con configuración", {
      windowSize,
      overlapFactor,
      usePreallocatedBuffers
    });
  }
  
  /**
   * Prepara segmentos de señal para procesamiento ML
   * No genera datos nuevos, solo prepara datos existentes
   */
  public prepareSignalBatches(values: number[]): number[][][] {
    if (values.length < this.windowSize) {
      // No hay suficientes datos para procesar
      return [[[]]];
    }
    
    const stride = Math.floor(this.windowSize * (1 - this.overlapFactor));
    const numSegments = Math.floor((values.length - this.windowSize) / stride) + 1;
    
    // Crear segmentos con superposición
    const segments: number[][][] = [];
    
    for (let i = 0; i < numSegments; i++) {
      const startIdx = i * stride;
      const segment: number[][] = [];
      
      for (let j = 0; j < this.windowSize; j++) {
        segment.push([values[startIdx + j]]);
      }
      
      segments.push(segment);
    }
    
    return segments;
  }
  
  /**
   * Convierte array de JavaScript a tensor TensorFlow.js
   * Optimizado con buffer preasignado si está habilitado
   */
  public arrayToTensor(values: number[]): tf.Tensor1D {
    if (this.usePreallocatedBuffers && this.inputBuffer && values.length <= this.inputBuffer.length) {
      // Usar buffer preasignado para evitar reasignaciones
      this.inputBuffer.set(values);
      return tf.tensor1d(this.inputBuffer.subarray(0, values.length));
    } else {
      // Crear nuevo tensor
      return tf.tensor1d(values);
    }
  }
  
  /**
   * Convierte batch de arrays a tensor 3D
   */
  public batchToTensor(batch: number[][][]): tf.Tensor3D {
    return tf.tensor3d(batch);
  }
  
  /**
   * Convierte tensor a array de JavaScript
   * Optimizado con buffer preasignado si está habilitado
   */
  public async tensorToArray(tensor: tf.Tensor1D): Promise<number[]> {
    if (this.usePreallocatedBuffers && this.outputBuffer && tensor.size <= this.outputBuffer.length) {
      // Usar buffer preasignado con DataSync para evitar Promise overhead
      this.outputBuffer.set(tensor.dataSync());
      return Array.from(this.outputBuffer.subarray(0, tensor.size));
    } else {
      // Usar método async estándar
      return await tensor.array() as number[];
    }
  }
  
  /**
   * Recombina segmentos procesados en una señal continua
   * Usando combinación ponderada en áreas de superposición
   */
  public recombineSegments(
    processedSegments: number[][][],
    originalLength: number
  ): number[] {
    if (processedSegments.length === 0 || processedSegments[0].length === 0) {
      return [];
    }
    
    const stride = Math.floor(this.windowSize * (1 - this.overlapFactor));
    
    // Pre-asignar array de resultado con tamaño original
    const result = new Array(originalLength).fill(0);
    // Array para seguir el peso acumulado en cada posición
    const weights = new Array(originalLength).fill(0);
    
    // Función de peso - da más peso al centro de cada segmento
    const getWeight = (position: number): number => {
      // Función triangular simple centrada en la ventana
      return 1 - 2 * Math.abs(position / this.windowSize - 0.5);
    };
    
    // Aplicar cada segmento procesado con ponderación
    for (let i = 0; i < processedSegments.length; i++) {
      const startIdx = i * stride;
      const segment = processedSegments[i];
      
      for (let j = 0; j < segment.length && j < this.windowSize && startIdx + j < originalLength; j++) {
        const weight = getWeight(j);
        result[startIdx + j] += segment[j][0] * weight;
        weights[startIdx + j] += weight;
      }
    }
    
    // Normalizar por pesos acumulados
    for (let i = 0; i < result.length; i++) {
      if (weights[i] > 0) {
        result[i] /= weights[i];
      }
    }
    
    return result;
  }
  
  /**
   * Reinicia el transformador y libera recursos
   */
  public reset(): void {
    if (this.usePreallocatedBuffers) {
      if (this.inputBuffer) this.inputBuffer.fill(0);
      if (this.outputBuffer) this.outputBuffer.fill(0);
    }
  }
}

/**
 * Crea una instancia del transformador de datos
 */
export const createDataTransformer = (
  windowSize: number = 30,
  overlapFactor: number = 0.5,
  usePreallocatedBuffers: boolean = true
): DataTransformer => {
  return new DataTransformer(windowSize, overlapFactor, usePreallocatedBuffers);
};

