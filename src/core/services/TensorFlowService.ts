import { 
  TensorFlowConfig, 
  DEFAULT_TENSORFLOW_CONFIG, 
  DISABLED_TENSORFLOW_CONFIG 
} from '../neural/tensorflow/TensorFlowConfig';

/**
 * Servicio para gestionar la configuración y estado de TensorFlow
 * Proporciona métodos para habilitar/deshabilitar TensorFlow y obtener su estado
 */
export class TensorFlowService {
  private static instance: TensorFlowService;
  
  private config: TensorFlowConfig = DEFAULT_TENSORFLOW_CONFIG;
  private isInitialized: boolean = false;
  
  // Clave para almacenar la configuración en localStorage
  private static CONFIG_STORAGE_KEY = 'tensorflow_config';

  private constructor() {
    this.loadConfigFromStorage();
  }

  /**
   * Obtiene la instancia singleton del servicio
   */
  public static getInstance(): TensorFlowService {
    if (!TensorFlowService.instance) {
      TensorFlowService.instance = new TensorFlowService();
    }
    return TensorFlowService.instance;
  }

  /**
   * Inicializa la configuración y carga desde el almacenamiento
   * Intenta recuperar la configuración guardada o usa la predeterminada
   */
  private loadConfigFromStorage(): void {
    try {
      const storedConfig = localStorage.getItem(TensorFlowService.CONFIG_STORAGE_KEY);
      if (storedConfig) {
        const parsedConfig = JSON.parse(storedConfig) as Partial<TensorFlowConfig>;
        this.config = {
          ...DEFAULT_TENSORFLOW_CONFIG,
          ...parsedConfig
        };
        console.log('TensorFlow config cargada desde almacenamiento:', this.config);
      }
    } catch (error) {
      console.error('Error al cargar configuración de TensorFlow:', error);
      this.config = DEFAULT_TENSORFLOW_CONFIG;
    }
  }

  /**
   * Guarda la configuración en el almacenamiento local
   */
  private saveConfigToStorage(): void {
    try {
      localStorage.setItem(TensorFlowService.CONFIG_STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('Error al guardar configuración de TensorFlow:', error);
    }
  }

  /**
   * Verifica si TensorFlow está habilitado
   */
  public isTensorFlowEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Habilita TensorFlow y redes neuronales
   */
  public enableTensorFlow(): void {
    console.log('Habilitando TensorFlow y redes neuronales');
    this.config.enabled = true;
    this.saveConfigToStorage();
  }

  /**
   * Deshabilita TensorFlow y redes neuronales
   * No elimina las dependencias, solo previene su inicialización
   */
  public disableTensorFlow(): void {
    console.log('Deshabilitando TensorFlow y redes neuronales');
    this.config.enabled = false;
    this.saveConfigToStorage();
  }

  /**
   * Obtiene la configuración actual de TensorFlow
   */
  public getConfig(): TensorFlowConfig {
    return { ...this.config };
  }

  /**
   * Actualiza la configuración de TensorFlow
   */
  public updateConfig(newConfig: Partial<TensorFlowConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
    this.saveConfigToStorage();
  }

  /**
   * Resetea la configuración a los valores predeterminados
   */
  public resetConfig(): void {
    this.config = DEFAULT_TENSORFLOW_CONFIG;
    this.saveConfigToStorage();
  }
}

// Función de utilidad para acceso rápido al servicio
export function getTensorFlowService(): TensorFlowService {
  return TensorFlowService.getInstance();
} 