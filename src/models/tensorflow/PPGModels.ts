
import * as tf from '@tensorflow/tfjs';

/**
 * Generador de modelos TensorFlow.js para análisis de PPG
 * Esta clase proporciona modelos pre-configurados para diferentes análisis
 */
export class PPGModels {
  /**
   * Crea un modelo para detección de dedos en imágenes
   */
  public static createFingerDetectionModel(): tf.LayersModel {
    const model = tf.sequential();
    
    // Capa convolucional para procesar imágenes
    model.add(tf.layers.conv2d({
      inputShape: [96, 96, 3], // Entrada reducida para mejor rendimiento
      filters: 16,
      kernelSize: 3,
      activation: 'relu'
    }));
    
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));
    
    model.add(tf.layers.conv2d({
      filters: 32,
      kernelSize: 3,
      activation: 'relu'
    }));
    
    model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }));
    model.add(tf.layers.flatten());
    
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu'
    }));
    
    model.add(tf.layers.dense({
      units: 1,
      activation: 'sigmoid'
    }));
    
    model.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    return model;
  }
  
  /**
   * Crea un modelo para análisis de ritmo cardíaco
   */
  public static createHeartRateModel(): tf.LayersModel {
    const model = tf.sequential();
    
    // Modelo basado en LSTM para análisis de series temporales
    model.add(tf.layers.lstm({
      units: 64,
      returnSequences: true,
      inputShape: [30, 1] // 30 muestras temporales, 1 característica (PPG)
    }));
    
    model.add(tf.layers.lstm({
      units: 32,
      returnSequences: false
    }));
    
    model.add(tf.layers.dense({
      units: 16,
      activation: 'relu'
    }));
    
    model.add(tf.layers.dense({
      units: 1, // Salida: BPM
      activation: 'linear'
    }));
    
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });
    
    return model;
  }
  
  /**
   * Crea un modelo para detección de arritmias
   */
  public static createArrhythmiaDetectionModel(): tf.LayersModel {
    const model = tf.sequential();
    
    // Modelo especializado en detección de patrones irregulares
    model.add(tf.layers.lstm({
      units: 128,
      returnSequences: true,
      inputShape: [60, 1] // 60 muestras temporales para mejor detección
    }));
    
    model.add(tf.layers.dropout({ rate: 0.25 }));
    
    model.add(tf.layers.lstm({
      units: 64,
      returnSequences: false
    }));
    
    model.add(tf.layers.dropout({ rate: 0.25 }));
    
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu'
    }));
    
    model.add(tf.layers.dense({
      units: 4, // Múltiples clases de arritmias
      activation: 'softmax'
    }));
    
    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    return model;
  }
  
  /**
   * Crea un modelo para estimación de SPO2
   */
  public static createSPO2Model(): tf.LayersModel {
    const model = tf.sequential();
    
    // Modelo para análisis multicanal (rojo/IR)
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
      inputShape: [20] // 10 muestras de ratio AC/DC para 2 canales
    }));
    
    model.add(tf.layers.dense({
      units: 16,
      activation: 'relu'
    }));
    
    model.add(tf.layers.dense({
      units: 1,
      activation: 'linear'
    }));
    
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });
    
    return model;
  }
  
  /**
   * Crea un modelo para estimación de presión arterial
   */
  public static createBloodPressureModel(): tf.LayersModel {
    const model = tf.sequential();
    
    // Modelo para características temporales y morfológicas
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      inputShape: [15] // Características morfológicas de la onda PPG
    }));
    
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu'
    }));
    
    model.add(tf.layers.dense({
      units: 2, // Sistólica y diastólica
      activation: 'linear'
    }));
    
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });
    
    return model;
  }
}
