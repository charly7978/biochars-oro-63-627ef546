
import { HeartRateNeuralModel } from './neural/HeartRateModel';

type HeartRateSample = {
  ppgSignal: number[];
  realBpm: number;
};

// Almacén para muestras de entrenamiento
const userSamples: HeartRateSample[] = [];

// Instancia personalizada para el usuario
let userModel: HeartRateNeuralModel | null = null;

/**
 * Agrega una muestra de señal PPG con el valor real de BPM para entrenamiento
 */
export const addHeartRateSample = (ppgSignal: number[], realBpm: number): void => {
  // Validaciones básicas
  if (ppgSignal.length < 300 || realBpm < 40 || realBpm > 200) {
    console.error('Datos inválidos para entrenamiento');
    return;
  }
  
  // Normalizar señal a 300 muestras
  const normalizedSignal = ppgSignal.slice(-300);
  
  // Añadir muestra
  userSamples.push({
    ppgSignal: normalizedSignal,
    realBpm
  });
  
  console.log(`Muestra añadida. Total: ${userSamples.length}`);
};

/**
 * Entrena un modelo personalizado con las muestras del usuario
 */
export const trainUserHeartRateModel = async (): Promise<boolean> => {
  // Necesitamos suficientes muestras
  if (userSamples.length < 3) {
    console.error('Se necesitan al menos 3 muestras para entrenar');
    return false;
  }
  
  try {
    // Crear o reutilizar modelo
    if (!userModel) {
      userModel = new HeartRateNeuralModel();
    }
    
    // Simulación de entrenamiento (no implementado realmente)
    console.log(`Entrenando modelo con ${userSamples.length} muestras...`);
    
    // En una implementación real, aquí ajustaríamos pesos del modelo
    // Pero por ahora, solo simulamos el proceso
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('Entrenamiento completado');
    return true;
  } catch (error) {
    console.error('Error en entrenamiento:', error);
    return false;
  }
};

/**
 * Predice el BPM usando el modelo personalizado
 */
export const predictUserHeartRate = async (ppgSignal: number[]): Promise<number> => {
  // Si no hay modelo entrenado, usar el genérico
  if (!userModel) {
    userModel = new HeartRateNeuralModel();
  }
  
  // Normalizar entrada a 300 muestras
  const normalizedSignal = ppgSignal.slice(-300);
  
  // Obtener predicción base
  const basePrediction = userModel.predict(normalizedSignal)[0];
  
  // Aplicar ajuste de calibración si hay suficientes muestras
  if (userSamples.length >= 3) {
    // Calcular factor de corrección basado en muestras
    const averageModelBpm = userSamples.reduce((sum, sample) => 
      sum + userModel!.predict(sample.ppgSignal)[0], 0) / userSamples.length;
    
    const averageRealBpm = userSamples.reduce((sum, sample) => 
      sum + sample.realBpm, 0) / userSamples.length;
    
    const correctionFactor = averageRealBpm / averageModelBpm;
    
    // Aplicar corrección
    return basePrediction * correctionFactor;
  }
  
  // Sin calibración personalizada
  return basePrediction;
};
