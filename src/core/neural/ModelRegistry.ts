
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
  private initialized: boolean = false;
  
  private constructor() {
    this.initializeModels();
  }
  
  /**
   * Inicializa los modelos disponibles
   */
  private initializeModels(): void {
    if (this.initialized) return;
    
    // Registrar modelos disponibles
    this.models.set('heartRate', new HeartRateNeuralModel());
    this.models.set('spo2', new SpO2NeuralModel());
    this.models.set('bloodPressure', new BloodPressureNeuralModel());
    this.models.set('arrhythmia', new ArrhythmiaNeuralModel());
    this.models.set('glucose', new GlucoseNeuralModel());
    
    this.initialized = true;
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
   * Obtiene un modelo por su ID, inicializándolo (cargándolo) si es necesario
   * Retorna el modelo directamente, no una promesa
   */
  public getModel<T extends BaseNeuralModel>(id: string): T | null {
    const model = this.models.get(id) as T;
    if (!model) return null;
    
    // Iniciar carga en background si no está cargado
    if (!model.getModelInfo().isLoaded) {
      console.log(`Iniciando carga de modelo en background: ${id}`);
      // Iniciar carga pero no esperar resultado
      model.loadModel().catch(err => {
        console.error(`Error al cargar modelo ${id}:`, err);
      });
    }
    
    return model;
  }
  
  /**
   * Reinicia todos los modelos o uno específico
   */
  public resetModels(specificId?: string): void {
    if (specificId) {
      const model = this.models.get(specificId);
      if (model) {
        console.log(`Reiniciando modelo específico: ${specificId}`);
        this.models.set(specificId, new (Object.getPrototypeOf(model).constructor)());
      }
    } else {
      // Reiniciar todos los modelos
      console.log('Reiniciando todos los modelos');
      const modelIds = Array.from(this.models.keys());
      for (const id of modelIds) {
        const model = this.models.get(id);
        if (model) {
          this.models.set(id, new (Object.getPrototypeOf(model).constructor)());
        }
      }
    }
  }
  
  /**
   * Devuelve información sobre todos los modelos registrados
   */
  public getModelInfo(): Array<{
    id: string;
    name: string;
    version: string;
    initialized: boolean;
    architecture: string;
  }> {
    return Array.from(this.models.entries()).map(([id, model]) => ({
      id,
      name: model.getModelInfo().name,
      version: model.getModelInfo().version,
      initialized: model.getModelInfo().isLoaded,
      architecture: model.architecture
    }));
  }
  
  /**
   * Libera recursos utilizados por los modelos
   */
  public dispose(): void {
    // Limpiar modelos
    this.models.clear();
  }
}

/**
 * Función de utilidad para acceso rápido a modelos (ahora sincrónica)
 */
export function getModel<T extends BaseNeuralModel>(id: string): T | null {
  return ModelRegistry.getInstance().getModel<T>(id);
}
