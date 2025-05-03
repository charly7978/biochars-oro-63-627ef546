/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { BaseNeuralModel } from './NeuralNetworkBase';
import { HeartRateNeuralModel } from './HeartRateModel';
import { SpO2NeuralModel } from './SpO2Model';
import { BloodPressureNeuralModel } from './BloodPressureModel';
import { ArrhythmiaNeuralModel } from './ArrhythmiaModel';
import { GlucoseNeuralModel } from './GlucoseModel';

/**
 * Registro centralizado de modelos neuronales
 * Facilita la gestión, carga perezosa y acceso a modelos
 */
export class ModelRegistry {
  private static instance: ModelRegistry;
  private models: Map<string, BaseNeuralModel> = new Map();
  
  private constructor() {
    // Registrar modelos disponibles
    console.log("Initializing Model Registry...");
    this.registerModel('heartRate', () => new HeartRateNeuralModel());
    this.registerModel('spo2', () => new SpO2NeuralModel());
    this.registerModel('bloodPressure', () => new BloodPressureNeuralModel());
    this.registerModel('arrhythmia', () => new ArrhythmiaNeuralModel());
    this.registerModel('glucose', () => new GlucoseNeuralModel());
    console.log("Model Registry Initialized with model instances.");
  }
  
  /**
   * Obtiene la instancia singleton del registro
   */
  public static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }
  
  /**
   * Registra un factory de modelo
   */
  private registerModel(id: string, factory: () => BaseNeuralModel): void {
    if (!this.models.has(id)) {
      console.log(`Registering model factory for: ${id}`);
      // Crear la instancia aquí. La carga real (async) ocurre dentro del constructor del modelo.
      try {
          const modelInstance = factory();
          this.models.set(id, modelInstance);
          console.log(`Model instance created for: ${id}`);
      } catch (error) {
           console.error(`Failed to instantiate model ${id}:`, error);
      }
      
    } else {
      console.warn(`ModelRegistry: Model with id '${id}' already registered.`);
    }
  }
  
  /**
   * Obtiene un modelo por su ID, inicializándolo si es necesario
   */
  public getModel<T extends BaseNeuralModel>(id: string): T | null {
    const model = this.models.get(id);
    if (!model) {
      console.warn(`ModelRegistry: Model with id '${id}' not found.`);
      return null;
    }
    // La carga es asíncrona, el que llama debe verificar model.isLoaded()
    return model as T;
  }
  
  /**
   * Reinicia todos los modelos o uno específico
   */
  public resetModels(specificId?: string): void {
    if (specificId) {
      const model = this.models.get(specificId);
      if (model) {
        // TODO: Implementar un método `resetState()` en BaseNeuralModel si es necesario
        // para limpiar estados internos sin recargar pesos.
        console.log(`ModelRegistry: Resetting state for model '${specificId}' (if implemented).`);
        // model.resetState?.(); 
      } else {
        console.warn(`ModelRegistry: Cannot reset non-existent model '${specificId}'.`);
      }
    } else {
      console.log("ModelRegistry: Resetting state for all models (if implemented).");
      this.models.forEach(model => {
        // model.resetState?.();
      });
      // Opcional: Podríamos querer volver a registrar/cargar todo aquí
      // this.models.clear();
      // this.initializeModels(); // Si hubiera un método así
    }
  }
  
  /**
   * Devuelve información sobre todos los modelos registrados
   */
  public getModelInfo(): Array<{
    id: string;
    name: string;
    version: string;
    loaded: boolean;
    architecture: string;
  }> {
    const info: Array<{ id: string; name: string; version: string; loaded: boolean; architecture: string; }> = [];
    this.models.forEach((model, id) => {
      info.push({
        id,
        name: model.name,
        version: model.version,
        loaded: model.isLoaded(),
        architecture: model.architecture,
      });
    });
    return info;
  }
  
  /**
   * Libera recursos utilizados por los modelos
   */
  public dispose(): void {
    console.log("Disposing all models in registry...");
    this.models.forEach((model, id) => {
      try {
          model.dispose();
      } catch(e) {
           console.error(`Error disposing model ${id}:`, e);
      }
    });
    this.models.clear();
    console.log("Model registry cleared.");
  }
}

/**
 * Función de utilidad para acceso rápido a modelos
 */
export function getModel<T extends BaseNeuralModel>(id: string): T | null {
  return ModelRegistry.getInstance().getModel<T>(id);
}
