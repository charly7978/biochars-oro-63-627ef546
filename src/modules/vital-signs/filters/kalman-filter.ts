
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Implementación de Filtro de Kalman para fusión de estimadores
 * Diseñado específicamente para integración de estimadores de frecuencia cardíaca
 */

/**
 * Opciones de configuración para el filtro de Kalman
 */
export interface KalmanFilterOptions {
  stateSize: number;           // Dimensión del vector de estado
  observationSize: number;     // Dimensión del vector de observación
  processNoise?: number;       // Varianza del ruido del proceso (Q)
  observationNoise?: number;   // Varianza del ruido de observación (R)
  initialState?: number[];     // Estado inicial
  initialCovariance?: number;  // Covarianza inicial
}

/**
 * Implementación del Filtro de Kalman
 * Optimizada para datos de frecuencia cardíaca y fusión de estimadores
 */
export class KalmanFilter {
  // Dimensiones
  private stateSize: number;
  private observationSize: number;

  // Matrices de estado
  private state: number[];             // Vector de estado x
  private covariance: number[][];      // Matriz de covarianza P
  private transition: number[][];      // Matriz de transición F
  private observation: number[][];     // Matriz de observación H
  private processNoise: number[][];    // Matriz de covarianza del ruido del proceso Q
  private observationNoise: number[][]; // Matriz de covarianza del ruido de observación R

  /**
   * Constructor con opciones de configuración
   */
  constructor(options: KalmanFilterOptions) {
    this.stateSize = options.stateSize;
    this.observationSize = options.observationSize;
    
    // Inicializar estado y covarianza
    this.state = options.initialState ? [...options.initialState] : new Array(this.stateSize).fill(0);
    
    // Crear matriz de covarianza inicial
    const initialCovariance = options.initialCovariance || 1.0;
    this.covariance = [];
    for (let i = 0; i < this.stateSize; i++) {
      this.covariance[i] = new Array(this.stateSize).fill(0);
      this.covariance[i][i] = initialCovariance;
    }
    
    // Matriz de transición (identidad por defecto)
    this.transition = [];
    for (let i = 0; i < this.stateSize; i++) {
      this.transition[i] = new Array(this.stateSize).fill(0);
      this.transition[i][i] = 1.0; // Matriz identidad
    }
    
    // Matriz de observación (identidad por defecto para observationSize <= stateSize)
    this.observation = [];
    for (let i = 0; i < this.observationSize; i++) {
      this.observation[i] = new Array(this.stateSize).fill(0);
      if (i < this.stateSize) {
        this.observation[i][i] = 1.0;
      }
    }
    
    // Matriz de ruido del proceso
    const processNoiseValue = options.processNoise || 0.01;
    this.processNoise = [];
    for (let i = 0; i < this.stateSize; i++) {
      this.processNoise[i] = new Array(this.stateSize).fill(0);
      this.processNoise[i][i] = processNoiseValue;
    }
    
    // Matriz de ruido de observación
    const observationNoiseValue = options.observationNoise || 0.1;
    this.observationNoise = [];
    for (let i = 0; i < this.observationSize; i++) {
      this.observationNoise[i] = new Array(this.observationSize).fill(0);
      this.observationNoise[i][i] = observationNoiseValue;
    }
  }
  
  /**
   * Realizar predicción (etapa de tiempo)
   * x = F*x
   * P = F*P*F' + Q
   */
  public predict(): void {
    // Predicción de estado: x = F*x
    const newState = new Array(this.stateSize).fill(0);
    for (let i = 0; i < this.stateSize; i++) {
      for (let j = 0; j < this.stateSize; j++) {
        newState[i] += this.transition[i][j] * this.state[j];
      }
    }
    this.state = newState;
    
    // Predicción de covarianza: P = F*P*F' + Q
    // Paso 1: temp = F*P
    const temp: number[][] = [];
    for (let i = 0; i < this.stateSize; i++) {
      temp[i] = new Array(this.stateSize).fill(0);
      for (let j = 0; j < this.stateSize; j++) {
        for (let k = 0; k < this.stateSize; k++) {
          temp[i][j] += this.transition[i][k] * this.covariance[k][j];
        }
      }
    }
    
    // Paso 2: P = temp*F' + Q
    const newCovariance: number[][] = [];
    for (let i = 0; i < this.stateSize; i++) {
      newCovariance[i] = new Array(this.stateSize).fill(0);
      for (let j = 0; j < this.stateSize; j++) {
        for (let k = 0; k < this.stateSize; k++) {
          newCovariance[i][j] += temp[i][k] * this.transition[j][k]; // Nota: F' es la transpuesta
        }
        newCovariance[i][j] += this.processNoise[i][j];
      }
    }
    
    this.covariance = newCovariance;
  }
  
  /**
   * Realizar actualización (etapa de medición)
   * K = P*H'*inv(H*P*H' + R)
   * x = x + K*(z - H*x)
   * P = (I - K*H)*P
   * @param observation Vector de observación (medición)
   */
  public update(observation: number[]): void {
    // Verificar dimensiones
    if (observation.length !== this.observationSize) {
      throw new Error(`La observación debe tener dimensión ${this.observationSize}`);
    }
    
    // Paso 1: Calcular residuo y = z - H*x
    const residual: number[] = new Array(this.observationSize).fill(0);
    for (let i = 0; i < this.observationSize; i++) {
      residual[i] = observation[i];
      for (let j = 0; j < this.stateSize; j++) {
        residual[i] -= this.observation[i][j] * this.state[j];
      }
    }
    
    // Paso 2: Calcular covarianza de residuo S = H*P*H' + R
    // Primero calculamos temp1 = H*P
    const temp1: number[][] = [];
    for (let i = 0; i < this.observationSize; i++) {
      temp1[i] = new Array(this.stateSize).fill(0);
      for (let j = 0; j < this.stateSize; j++) {
        for (let k = 0; k < this.stateSize; k++) {
          temp1[i][j] += this.observation[i][k] * this.covariance[k][j];
        }
      }
    }
    
    // Luego S = temp1*H' + R
    const residualCovariance: number[][] = [];
    for (let i = 0; i < this.observationSize; i++) {
      residualCovariance[i] = new Array(this.observationSize).fill(0);
      for (let j = 0; j < this.observationSize; j++) {
        for (let k = 0; k < this.stateSize; k++) {
          residualCovariance[i][j] += temp1[i][k] * this.observation[j][k]; // H' es la transpuesta
        }
        residualCovariance[i][j] += this.observationNoise[i][j];
      }
    }
    
    // Paso 3: Calcular ganancia de Kalman K = P*H'*inv(S)
    // Primero calculamos temp2 = P*H'
    const temp2: number[][] = [];
    for (let i = 0; i < this.stateSize; i++) {
      temp2[i] = new Array(this.observationSize).fill(0);
      for (let j = 0; j < this.observationSize; j++) {
        for (let k = 0; k < this.stateSize; k++) {
          temp2[i][j] += this.covariance[i][k] * this.observation[j][k]; // H' es la transpuesta
        }
      }
    }
    
    // Para sistemas pequeños, calcular inversa directamente (simplificado para observationSize=1)
    // En casos más complejos, se usaría descomposición LU o Cholesky
    let kalmanGain: number[][];
    
    if (this.observationSize === 1) {
      // Caso simplificado para sistemas escalares (frecuencia cardíaca)
      const invS = 1.0 / residualCovariance[0][0];
      kalmanGain = [];
      for (let i = 0; i < this.stateSize; i++) {
        kalmanGain[i] = [temp2[i][0] * invS];
      }
    } else {
      // Para dimensiones mayores (no utilizado en este caso)
      throw new Error("Dimensión de observación > 1 no implementada");
    }
    
    // Paso 4: Actualizar estado x = x + K*y
    for (let i = 0; i < this.stateSize; i++) {
      for (let j = 0; j < this.observationSize; j++) {
        this.state[i] += kalmanGain[i][j] * residual[j];
      }
    }
    
    // Paso 5: Actualizar covarianza P = (I - K*H)*P
    // Primero calculamos temp3 = K*H
    const temp3: number[][] = [];
    for (let i = 0; i < this.stateSize; i++) {
      temp3[i] = new Array(this.stateSize).fill(0);
      for (let j = 0; j < this.stateSize; j++) {
        for (let k = 0; k < this.observationSize; k++) {
          temp3[i][j] += kalmanGain[i][k] * this.observation[k][j];
        }
      }
    }
    
    // Luego P = (I - temp3)*P
    const newCovariance: number[][] = [];
    for (let i = 0; i < this.stateSize; i++) {
      newCovariance[i] = new Array(this.stateSize).fill(0);
      for (let j = 0; j < this.stateSize; j++) {
        let factor = (i === j) ? 1.0 : 0.0; // Elemento de matriz identidad
        factor -= temp3[i][j];
        
        for (let k = 0; k < this.stateSize; k++) {
          newCovariance[i][j] += factor * this.covariance[k][j];
        }
      }
    }
    
    this.covariance = newCovariance;
  }
  
  /**
   * Obtener el estado actual
   */
  public getState(): number[] {
    return [...this.state];
  }
  
  /**
   * Obtener la matriz de covarianza actual
   */
  public getCovariance(): number[][] {
    return this.covariance.map(row => [...row]);
  }
  
  /**
   * Establecer la matriz de ruido del proceso
   * Útil para ajustar dinámicamente la sensibilidad del filtro
   */
  public setProcessNoise(value: number): void {
    for (let i = 0; i < this.stateSize; i++) {
      this.processNoise[i][i] = value;
    }
  }
  
  /**
   * Establecer la matriz de ruido de observación
   * Útil para ajustar dinámicamente la confianza en las mediciones
   */
  public setObservationNoise(value: number): void {
    for (let i = 0; i < this.observationSize; i++) {
      this.observationNoise[i][i] = value;
    }
  }
  
  /**
   * Resetear el filtro a valores iniciales
   */
  public reset(initialState?: number[]): void {
    // Resetear estado
    if (initialState) {
      this.state = [...initialState];
    } else {
      this.state = new Array(this.stateSize).fill(0);
    }
    
    // Resetear covarianza a diagonal con valores altos (incertidumbre)
    for (let i = 0; i < this.stateSize; i++) {
      for (let j = 0; j < this.stateSize; j++) {
        this.covariance[i][j] = (i === j) ? 1.0 : 0.0;
      }
    }
  }
}
