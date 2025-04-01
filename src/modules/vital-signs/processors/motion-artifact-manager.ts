
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Specialized manager for handling motion artifacts in PPG signals
 * Uses real signal processing techniques to detect and compensate for movement
 */
export class MotionArtifactManager {
  // Configuración para detección de movimiento
  private readonly SENSITIVITY = 0.75; // Sensibilidad de detección (0-1)
  private readonly RECOVERY_TIME_MS = 1200; // Tiempo de recuperación tras artefacto
  private readonly MOTION_BUFFER_SIZE = 30; // Tamaño de buffer para análisis de movimiento
  
  // Buffers para análisis
  private motionBuffer: number[] = [];
  private accelerometerHistory: {timestamp: number, x: number, y: number, z: number}[] = [];
  private lastMotionTimestamp: number = 0;
  private motionDetected: boolean = false;
  
  // Parámetros para ICA
  private readonly ICA_COMPONENTS = 3;
  private readonly ICA_ITERATIONS = 5;
  private readonly ICA_LEARNING_RATE = 0.1;
  private icaBuffer: number[][] = [];
  private icaWeights: number[][] = [];
  private icaInitialized: boolean = false;
  
  // Buffer multiespectral
  private redBuffer: number[] = [];
  private irBuffer: number[] = [];
  private readonly WAVELENGTH_BUFFER_SIZE = 20;
  
  constructor(sensitivity: number = 0.75) {
    this.SENSITIVITY = Math.min(Math.max(sensitivity, 0.1), 1.0);
    this.initializeICA();
  }
  
  /**
   * Inicializar matrices para ICA
   */
  private initializeICA(): void {
    // Inicializar buffers para componentes
    this.icaBuffer = Array(this.ICA_COMPONENTS).fill(0).map(() => []);
    
    // Inicializar matriz de pesos aleatoria
    this.icaWeights = Array(this.ICA_COMPONENTS).fill(0).map(() => 
      Array(this.ICA_COMPONENTS).fill(0).map(() => Math.random() - 0.5)
    );
    
    // Ortonormalizar matriz inicial
    this.orthogonalizeWeights();
    
    this.icaInitialized = true;
  }
  
  /**
   * Ortonormalizar matriz de pesos
   */
  private orthogonalizeWeights(): void {
    // Implementación simplificada de ortonormalización de Gram-Schmidt
    for (let i = 0; i < this.ICA_COMPONENTS; i++) {
      // Normalizar el vector i
      const norm = Math.sqrt(this.icaWeights[i].reduce((sum, w) => sum + w * w, 0));
      if (norm > 0) {
        this.icaWeights[i] = this.icaWeights[i].map(w => w / norm);
      }
      
      // Restar proyecciones de vectores anteriores
      for (let j = i + 1; j < this.ICA_COMPONENTS; j++) {
        // Calcular producto escalar
        const dotProduct = this.icaWeights[i].reduce((sum, w, k) => sum + w * this.icaWeights[j][k], 0);
        
        // Restar proyección
        this.icaWeights[j] = this.icaWeights[j].map((w, k) => w - dotProduct * this.icaWeights[i][k]);
      }
    }
  }
  
  /**
   * Procesar un valor PPG para detectar y compensar artefactos de movimiento
   */
  public processValue(
    ppgValue: number, 
    accelerometerData?: {x: number, y: number, z: number},
    irValue?: number
  ): {
    processedValue: number;
    motionDetected: boolean;
    compensationApplied: boolean;
  } {
    // Actualizar buffers
    this.updateBuffers(ppgValue, accelerometerData, irValue);
    
    // Detectar movimiento
    const motion = this.detectMotion(accelerometerData);
    
    // Aplicar compensación si es necesario
    let processedValue = ppgValue;
    let compensationApplied = false;
    
    if (motion) {
      // Si tenemos múltiples longitudes de onda, usar compensación espectral
      if (this.irBuffer.length > 5) {
        processedValue = this.applySpectralCompensation(ppgValue);
        compensationApplied = true;
      } 
      // De lo contrario, usar ICA si hay suficientes datos
      else if (this.icaBuffer[0].length > 10) {
        processedValue = this.applyICACompensation(ppgValue);
        compensationApplied = true;
      }
    }
    
    return {
      processedValue,
      motionDetected: motion,
      compensationApplied
    };
  }
  
  /**
   * Actualizar buffers internos con nuevos datos
   */
  private updateBuffers(
    ppgValue: number, 
    accelerometerData?: {x: number, y: number, z: number},
    irValue?: number
  ): void {
    // Actualizar buffer de PPG
    this.motionBuffer.push(ppgValue);
    if (this.motionBuffer.length > this.MOTION_BUFFER_SIZE) {
      this.motionBuffer.shift();
    }
    
    // Actualizar buffer de acelerómetro
    if (accelerometerData) {
      this.accelerometerHistory.push({
        timestamp: Date.now(),
        ...accelerometerData
      });
      
      // Limitar tamaño del historial
      while (this.accelerometerHistory.length > 0 && 
             Date.now() - this.accelerometerHistory[0].timestamp > 3000) {
        this.accelerometerHistory.shift();
      }
    }
    
    // Actualizar buffers espectrales
    this.redBuffer.push(ppgValue);
    if (this.redBuffer.length > this.WAVELENGTH_BUFFER_SIZE) {
      this.redBuffer.shift();
    }
    
    if (irValue !== undefined) {
      this.irBuffer.push(irValue);
      if (this.irBuffer.length > this.WAVELENGTH_BUFFER_SIZE) {
        this.irBuffer.shift();
      }
    }
    
    // Actualizar buffers ICA
    // Componente 1: señal original
    this.icaBuffer[0].push(ppgValue);
    if (this.icaBuffer[0].length > this.MOTION_BUFFER_SIZE) {
      this.icaBuffer[0].shift();
    }
    
    // Componente 2: señal con delay
    this.icaBuffer[1].push(
      this.icaBuffer[0].length > 2 ? 
      this.icaBuffer[0][this.icaBuffer[0].length - 3] : 
      ppgValue
    );
    if (this.icaBuffer[1].length > this.MOTION_BUFFER_SIZE) {
      this.icaBuffer[1].shift();
    }
    
    // Componente 3: tendencia
    const trend = this.icaBuffer[2].length > 0 ? 
      this.icaBuffer[2][this.icaBuffer[2].length - 1] * 0.9 + ppgValue * 0.1 : 
      ppgValue;
    this.icaBuffer[2].push(trend);
    if (this.icaBuffer[2].length > this.MOTION_BUFFER_SIZE) {
      this.icaBuffer[2].shift();
    }
  }
  
  /**
   * Detectar artefactos de movimiento usando datos del acelerómetro y análisis de señal
   */
  private detectMotion(accelerometerData?: {x: number, y: number, z: number}): boolean {
    const now = Date.now();
    
    // 1. Si estamos en período de recuperación, seguir reportando movimiento
    if (now - this.lastMotionTimestamp < this.RECOVERY_TIME_MS) {
      return true;
    }
    
    // 2. Detección basada en acelerómetro si disponible
    if (accelerometerData) {
      const magnitude = Math.sqrt(
        Math.pow(accelerometerData.x, 2) + 
        Math.pow(accelerometerData.y, 2) + 
        Math.pow(accelerometerData.z, 2)
      );
      
      // Movimiento significativo (umbral ajustado según sensibilidad)
      const threshold = 9.8 + (1.5 * this.SENSITIVITY); // Basado en gravedad
      if (magnitude > threshold) {
        this.lastMotionTimestamp = now;
        this.motionDetected = true;
        return true;
      }
      
      // Analizar cambios bruscos en aceleración si tenemos suficiente historia
      if (this.accelerometerHistory.length > 3) {
        const recentAccel = this.accelerometerHistory.slice(-3);
        const deltas = [];
        
        for (let i = 1; i < recentAccel.length; i++) {
          const prev = recentAccel[i-1];
          const curr = recentAccel[i];
          
          const deltaX = curr.x - prev.x;
          const deltaY = curr.y - prev.y;
          const deltaZ = curr.z - prev.z;
          
          const deltaMagnitude = Math.sqrt(deltaX*deltaX + deltaY*deltaY + deltaZ*deltaZ);
          deltas.push(deltaMagnitude);
        }
        
        // Detectar cambio brusco (umbral ajustado por sensibilidad)
        const maxDelta = Math.max(...deltas);
        const accelThreshold = 3.0 * this.SENSITIVITY;
        
        if (maxDelta > accelThreshold) {
          this.lastMotionTimestamp = now;
          this.motionDetected = true;
          return true;
        }
      }
    }
    
    // 3. Análisis basado en la propia señal PPG
    if (this.motionBuffer.length < 5) {
      return false;
    }
    
    // Calcular variaciones recientes
    const recentValues = this.motionBuffer.slice(-5);
    const variations = [];
    for (let i = 1; i < recentValues.length; i++) {
      variations.push(Math.abs(recentValues[i] - recentValues[i-1]));
    }
    
    // Calcular estadísticas
    const maxVariation = Math.max(...variations);
    const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
    
    // Comparar con historial para detectar anomalías
    const historicValues = this.motionBuffer.slice(0, -5);
    if (historicValues.length < 5) {
      return false;
    }
    
    const historicVariations = [];
    for (let i = 1; i < historicValues.length; i++) {
      historicVariations.push(Math.abs(historicValues[i] - historicValues[i-1]));
    }
    
    const historicAvgVariation = historicVariations.reduce((sum, val) => sum + val, 0) / historicVariations.length;
    const historicMaxVariation = Math.max(...historicVariations);
    
    // Calcular ratios (ajustados por sensibilidad)
    const avgRatio = avgVariation / (historicAvgVariation + 0.0001);
    const maxRatio = maxVariation / (historicMaxVariation + 0.0001);
    
    const avgThreshold = 2.0 * this.SENSITIVITY;
    const maxThreshold = 3.0 * this.SENSITIVITY;
    
    if (avgRatio > avgThreshold || maxRatio > maxThreshold) {
      this.lastMotionTimestamp = now;
      this.motionDetected = true;
      return true;
    }
    
    this.motionDetected = false;
    return false;
  }
  
  /**
   * Aplicar algoritmo ICA para separar componentes de señal y artefactos
   */
  private applyICACompensation(value: number): number {
    if (!this.icaInitialized || this.icaBuffer[0].length < 10) {
      return value;
    }
    
    // Crear matrices para ICA
    const samples = Math.min(...this.icaBuffer.map(b => b.length));
    if (samples < 10) return value;
    
    // Obtener los últimos N valores de cada componente
    const X = this.icaBuffer.map(buffer => buffer.slice(-samples));
    
    // Centrar los datos
    const means = X.map(component => 
      component.reduce((sum, val) => sum + val, 0) / component.length
    );
    
    const centeredX = X.map((component, i) => 
      component.map(val => val - means[i])
    );
    
    // Aplicar una iteración del algoritmo FastICA
    for (let iteration = 0; iteration < this.ICA_ITERATIONS; iteration++) {
      // Para cada componente
      for (let i = 0; i < this.ICA_COMPONENTS; i++) {
        // Calcular señal mezclada actual
        const mixedSignals = Array(samples).fill(0).map((_, sampleIdx) => 
          this.icaWeights[i].reduce((sum, weight, compIdx) => 
            sum + weight * centeredX[compIdx][sampleIdx], 0
          )
        );
        
        // Aplicar función de contraste g(y) = tanh(y)
        const g = mixedSignals.map(y => Math.tanh(y));
        
        // Calcular derivada g'(y) = 1 - tanh^2(y)
        const gPrime = mixedSignals.map(y => 1 - Math.pow(Math.tanh(y), 2));
        
        // Calcular nuevos pesos
        const newWeights = Array(this.ICA_COMPONENTS).fill(0);
        
        for (let j = 0; j < this.ICA_COMPONENTS; j++) {
          // E[x*g(w^T*x)]
          let term1 = 0;
          for (let k = 0; k < samples; k++) {
            term1 += centeredX[j][k] * g[k];
          }
          term1 /= samples;
          
          // E[g'(w^T*x)]*w
          const term2 = gPrime.reduce((sum, val) => sum + val, 0) / samples * this.icaWeights[i][j];
          
          // Actualizar peso con regla de aprendizaje
          newWeights[j] = (1 - this.ICA_LEARNING_RATE) * this.icaWeights[i][j] + 
                          this.ICA_LEARNING_RATE * (term1 - term2);
        }
        
        // Normalizar vector de pesos
        const norm = Math.sqrt(newWeights.reduce((sum, w) => sum + w * w, 0));
        if (norm > 0) {
          this.icaWeights[i] = newWeights.map(w => w / norm);
        }
      }
      
      // Ortogonalizar después de cada iteración
      this.orthogonalizeWeights();
    }
    
    // Extraer componentes y seleccionar la que tenga la frecuencia más cercana a ritmo cardíaco
    const extractedComponents = [];
    
    for (let i = 0; i < this.ICA_COMPONENTS; i++) {
      const component = Array(samples).fill(0).map((_, sampleIdx) => 
        this.icaWeights[i].reduce((sum, weight, compIdx) => 
          sum + weight * centeredX[compIdx][sampleIdx], 0
        )
      );
      
      extractedComponents.push(component);
    }
    
    // Seleccionar componente con menos artefactos
    // Heurística: menor variación derivativa
    const componentScores = extractedComponents.map(component => {
      const derivatives = [];
      for (let i = 1; i < component.length; i++) {
        derivatives.push(Math.abs(component[i] - component[i-1]));
      }
      derivatives.sort((a, b) => a - b);
      
      // Usar mediana de derivadas como score
      return derivatives[Math.floor(derivatives.length / 2)];
    });
    
    // Componente con menor score (suponiendo que es la señal PPG limpia)
    const bestComponentIdx = componentScores.indexOf(Math.min(...componentScores));
    const bestComponent = extractedComponents[bestComponentIdx];
    
    // Usar último valor de la mejor componente
    const compensatedValue = bestComponent[bestComponent.length - 1] + means[bestComponentIdx];
    
    // Mezclar con valor original para estabilidad
    return compensatedValue * 0.7 + value * 0.3;
  }
  
  /**
   * Aplicar compensación basada en múltiples longitudes de onda
   */
  private applySpectralCompensation(value: number): number {
    if (this.redBuffer.length < 5 || this.irBuffer.length < 5) {
      return value;
    }
    
    // Calcular ratios R/IR para detección de artefactos
    const ratios = [];
    const n = Math.min(this.redBuffer.length, this.irBuffer.length);
    
    for (let i = 0; i < n; i++) {
      if (Math.abs(this.irBuffer[i]) > 0.001) {
        ratios.push(this.redBuffer[i] / this.irBuffer[i]);
      }
    }
    
    if (ratios.length < 3) return value;
    
    // Calcular estadísticas de ratios
    ratios.sort((a, b) => a - b);
    const medianRatio = ratios[Math.floor(ratios.length / 2)];
    
    // Calcular ratio actual
    const currentRedValue = this.redBuffer[this.redBuffer.length - 1];
    const currentIrValue = this.irBuffer[this.irBuffer.length - 1];
    
    if (Math.abs(currentIrValue) < 0.001) return value;
    
    const currentRatio = currentRedValue / currentIrValue;
    
    // Detectar anomalías en el ratio
    const ratioDifference = Math.abs(currentRatio - medianRatio) / medianRatio;
    
    if (ratioDifference > 0.25 * this.SENSITIVITY) {
      // Artefacto detectado - corregir señal
      const correctedValue = currentRedValue * (medianRatio / currentRatio);
      
      // Mezclar con valor original para suavidad
      return correctedValue * 0.8 + value * 0.2;
    }
    
    return value;
  }
  
  /**
   * Resetear el estado del manager
   */
  public reset(): void {
    this.motionBuffer = [];
    this.accelerometerHistory = [];
    this.lastMotionTimestamp = 0;
    this.motionDetected = false;
    this.redBuffer = [];
    this.irBuffer = [];
    this.icaBuffer = Array(this.ICA_COMPONENTS).fill(0).map(() => []);
    this.initializeICA();
  }
  
  /**
   * Ajustar la sensibilidad de detección
   */
  public setSensitivity(sensitivity: number): void {
    this.SENSITIVITY = Math.min(Math.max(sensitivity, 0.1), 1.0);
  }
}
