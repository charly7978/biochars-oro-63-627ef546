import { BaseNeuralModel } from './NeuralNetworkBase';
import { HeartRateNeuralModel } from './HeartRateModel';
import { SpO2NeuralModel } from './SpO2Model';
import { BloodPressureNeuralModel } from './BloodPressureModel';
import { ArrhythmiaNeuralModel } from './ArrhythmiaModel';
import { GlucoseNeuralModel } from './GlucoseModel';
import { TensorFlowService } from '../services/TensorFlowService';

/**
 * Registro centralizado de modelos neuronales
 * Facilita la gestión, carga perezosa y acceso a modelos
 */
export class ModelRegistry {
  private static instance: ModelRegistry;
  private models: Map<string, BaseNeuralModel> = new Map();
  private modelInitialized: Map<string, boolean> = new Map();
  private isTensorFlowEnabled: boolean = true;
  
  private constructor() {
    // Comprobar si TensorFlow está habilitado
    this.updateTensorFlowStatus();
    
    // Registrar modelos disponibles solo si TensorFlow está habilitado
    if (this.isTensorFlowEnabled) {
      this.registerModel('heartRate', () => new HeartRateNeuralModel());
      this.registerModel('spo2', () => new SpO2NeuralModel());
      this.registerModel('bloodPressure', () => new BloodPressureNeuralModel());
      this.registerModel('arrhythmia', () => new ArrhythmiaNeuralModel());
      this.registerModel('glucose', () => new GlucoseNeuralModel());
    } else {
      console.log('ModelRegistry: TensorFlow deshabilitado, no se cargarán modelos neuronales');
    }
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
   * Actualiza el estado de TensorFlow
   */
  public updateTensorFlowStatus(): void {
    const tensorFlowService = TensorFlowService.getInstance();
    const previousState = this.isTensorFlowEnabled;
    this.isTensorFlowEnabled = tensorFlowService.isTensorFlowEnabled();
    
    // Si cambió el estado de habilitado a deshabilitado, limpiar modelos
    if (previousState && !this.isTensorFlowEnabled) {
      console.log('ModelRegistry: TensorFlow deshabilitado, liberando modelos');
      this.dispose();
    }
    // Si cambió de deshabilitado a habilitado, registrar modelos
    else if (!previousState && this.isTensorFlowEnabled) {
      console.log('ModelRegistry: TensorFlow habilitado, registrando modelos');
      this.registerModel('heartRate', () => new HeartRateNeuralModel());
      this.registerModel('spo2', () => new SpO2NeuralModel());
      this.registerModel('bloodPressure', () => new BloodPressureNeuralModel());
      this.registerModel('arrhythmia', () => new ArrhythmiaNeuralModel());
      this.registerModel('glucose', () => new GlucoseNeuralModel());
    }
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
    // Actualizar estado de TensorFlow
    this.updateTensorFlowStatus();
    
    // Si TensorFlow está deshabilitado, devolver null para que se usen fallbacks
    if (!this.isTensorFlowEnabled) {
      return null;
    }
    
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
   * Comprueba si un modelo está disponible
   */
  public hasModel(id: string): boolean {
    return this.isTensorFlowEnabled && this.models.has(id);
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
