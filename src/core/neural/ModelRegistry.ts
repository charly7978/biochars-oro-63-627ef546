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
  private modelInitialized: Map<string, boolean> = new Map();
  
  private constructor() {
    // Registrar modelos disponibles
    this.registerModel('heartRate', () => new HeartRateNeuralModel());
    this.registerModel('spo2', () => new SpO2NeuralModel());
    this.registerModel('bloodPressure', () => new BloodPressureNeuralModel());
    this.registerModel('arrhythmia', () => new ArrhythmiaNeuralModel());
    this.registerModel('glucose', () => new GlucoseNeuralModel());
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
    this.models.set(id, factory());
    this.modelInitialized.set(id, false);
  }
  
  /**
   * Obtiene un modelo por su ID, inicializándolo si es necesario
   */
  public getModel<T extends BaseNeuralModel>(id: string): T | null {
    const model = this.models.get(id) as T;
    if (!model) return null;
    
    // Inicializar modelo si es la primera vez que se usa
    if (!this.modelInitialized.get(id)) {
      console.log(`Inicializando modelo: ${id}`);
      this.modelInitialized.set(id, true);
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
        this.modelInitialized.set(specificId, false);
      }
    } else {
      // Reiniciar todos los modelos
      console.log('Reiniciando todos los modelos');
      const modelIds = Array.from(this.models.keys());
      for (const id of modelIds) {
        const model = this.models.get(id);
        if (model) {
          this.models.set(id, new (Object.getPrototypeOf(model).constructor)());
          this.modelInitialized.set(id, false);
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
      initialized: this.modelInitialized.get(id) || false,
      architecture: model.architecture
    }));
  }
  
  /**
   * Libera recursos utilizados por los modelos
   */
  public dispose(): void {
    // Limpiar modelos
    this.models.clear();
    this.modelInitialized.clear();
  }
}

/**
 * Función de utilidad para acceso rápido a modelos
 */
export function getModel<T extends BaseNeuralModel>(id: string): T | null {
  return ModelRegistry.getInstance().getModel<T>(id);
}
