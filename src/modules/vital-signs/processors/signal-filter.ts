/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Signal filtering utilities for processing real PPG signals
 * All methods work with real data only, no simulation
 * Enhanced with better filtering techniques for cleaner signal extraction
 * Improved with motion artifact detection and compensation
 */
export class SignalFilter {
  // Ventanas de filtrado optimizadas basadas en la literatura médica
  private readonly SMA_WINDOW_SIZE = 5;
  private readonly MEDIAN_WINDOW_SIZE = 5; // Aumentado para mejor filtrado de outliers
  private readonly LOW_PASS_ALPHA = 0.15; // Ajustado para mejor balance entre respuesta y suavizado
  private readonly BUTTERWORTH_CUTOFF = 0.1; // Normalizado a frecuencia de muestreo
  
  // Coeficientes de filtro Butterworth pre-calculados (filtro de paso bajo de 2º orden)
  private readonly BUTTERWORTH_B = [0.0201, 0.0402, 0.0201];
  private readonly BUTTERWORTH_A = [1.0000, -1.5610, 0.6414];
  
  // Nuevo: Filtro mejorado para cardio-óptica (pan-tompkins adaptado)
  private readonly CARDIO_OPTICAL_WINDOW = 12;
  private readonly DERIVATIVE_WINDOW = 5;
  
  // Buffer para filtros que requieren historial
  private butterworthInputHistory: number[] = [0, 0];
  private butterworthOutputHistory: number[] = [0, 0];
  
  // Historial para derivadas y análisis morfológico
  private valueHistory: number[] = [];
  private derivativeHistory: number[] = [];
  private secondDerivativeHistory: number[] = [];
  
  // Nuevo: Variables para detección y compensación de artefactos de movimiento
  private motionArtifactBuffer: number[] = [];
  private readonly MOTION_BUFFER_SIZE = 20;
  private readonly MOTION_THRESHOLD = 0.4; // Umbral para detección de artefactos
  private motionCompensationActive: boolean = false;
  private lastMotionArtifactTime: number = 0;
  private readonly MOTION_RECOVERY_TIME = 1000; // Tiempo de recuperación después de artefacto (ms)
  
  // Nuevo: Buffer para análisis ICA simplificado
  private signalComponentsBuffer: number[][] = [[], [], []]; // Múltiples componentes para ICA
  private readonly ICA_BUFFER_SIZE = 30;
  private readonly ICA_MIN_SAMPLES = 15;
  
  // Nuevo: Parámetros para compensación multiespectral
  private multiWavelengthBuffer: {red: number[], ir?: number[]} = {red: [], ir: []};
  private readonly WAVELENGTH_BUFFER_SIZE = 15;
  
  /**
   * Apply Moving Average filter to real values
   * Optimizado para mayor eficiencia computacional
   */
  public applySMAFilter(value: number, values: number[]): number {
    const windowSize = this.SMA_WINDOW_SIZE;
    
    if (values.length < windowSize) {
      return value;
    }
    
    // Utilizamos solo los valores más recientes para el cálculo
    const recentValues = values.slice(-windowSize);
    const sum = recentValues.reduce((acc, val) => acc + val, 0);
    return (sum + value) / (windowSize + 1);
  }
  
  /**
   * Apply Exponential Moving Average filter to real data
   * Implementación más eficiente y estable
   */
  public applyEMAFilter(value: number, values: number[], alpha: number = this.LOW_PASS_ALPHA): number {
    if (values.length === 0) {
      return value;
    }
    
    const lastValue = values[values.length - 1];
    
    // Protección contra NaN y valores extremos
    if (isNaN(value) || !isFinite(value)) {
      return lastValue;
    }
    
    // Limitación de cambios excesivos para proteger contra outliers
    const maxChange = Math.abs(lastValue) * 0.5;
    if (Math.abs(value - lastValue) > maxChange) {
      value = lastValue + (value > lastValue ? maxChange : -maxChange);
    }
    
    return alpha * value + (1 - alpha) * lastValue;
  }
  
  /**
   * Apply median filter to real data
   * Más efectivo para eliminar ruido impulsivo
   */
  public applyMedianFilter(value: number, values: number[]): number {
    if (values.length < this.MEDIAN_WINDOW_SIZE) {
      return value;
    }
    
    // Usando solo los valores más recientes + el valor actual
    const valuesForMedian = [...values.slice(-this.MEDIAN_WINDOW_SIZE), value];
    valuesForMedian.sort((a, b) => a - b);
    
    return valuesForMedian[Math.floor(valuesForMedian.length / 2)];
  }
  
  /**
   * Apply Butterworth low-pass filter (2nd order)
   * Implementación optimizada para procesamiento en tiempo real
   * Superior a EMA para preservar características de la señal PPG
   */
  public applyButterworthFilter(value: number): number {
    // Protección contra NaN y valores extremos
    if (isNaN(value) || !isFinite(value)) {
      return 0;
    }
    
    // Implementación directa de ecuación en diferencias del filtro IIR
    let outputValue = 
      this.BUTTERWORTH_B[0] * value + 
      this.BUTTERWORTH_B[1] * this.butterworthInputHistory[0] + 
      this.BUTTERWORTH_B[2] * this.butterworthInputHistory[1] - 
      this.BUTTERWORTH_A[1] * this.butterworthOutputHistory[0] - 
      this.BUTTERWORTH_A[2] * this.butterworthOutputHistory[1];
    
    // Actualizar historiales para la próxima muestra
    this.butterworthInputHistory[1] = this.butterworthInputHistory[0];
    this.butterworthInputHistory[0] = value;
    this.butterworthOutputHistory[1] = this.butterworthOutputHistory[0];
    this.butterworthOutputHistory[0] = outputValue;
    
    return outputValue;
  }
  
  /**
   * Apply combined filter pipeline for optimal PPG signal quality
   * Combina varios filtros para maximizar la extracción de señal
   */
  public applyFilterPipeline(value: number, values: number[]): number {
    // 1. Median filter para eliminar outliers
    const medianFiltered = this.applyMedianFilter(value, values);
    
    // 2. SMA para suavizado inicial
    const smaFiltered = this.applySMAFilter(medianFiltered, values);
    
    // 3. Butterworth para preservar la forma de onda PPG
    const butterworthFiltered = this.applyButterworthFilter(smaFiltered);
    
    // 4. EMA final para estabilizar
    const emaFiltered = this.applyEMAFilter(butterworthFiltered, values, this.LOW_PASS_ALPHA * 0.8);
    
    // 5. Actualizar historiales para análisis morfológico
    this.updateMorphologicalHistory(emaFiltered);
    
    return emaFiltered;
  }
  
  /**
   * Nuevo: Filtrado adaptado del algoritmo Pan-Tompkins para señales PPG
   * Implementa un filtrado más específico para las características cardio-ópticas
   */
  public applyCardioOpticalFilter(value: number, values: number[]): number {
    // Requiere suficiente historial para análisis
    if (values.length < this.CARDIO_OPTICAL_WINDOW) {
      return this.applyFilterPipeline(value, values);
    }
    
    // 1. Filtrado inicial como en el pipeline estándar
    const baselineFiltered = this.applyFilterPipeline(value, values);
    
    // 2. Análisis de morfología y derivadas para realzar componentes cardíacos
    const recentValues = [...values.slice(-this.CARDIO_OPTICAL_WINDOW), baselineFiltered];
    
    // 3. Cálculo adaptativo basado en derivadas para refuerzo de componentes cardíacos
    const firstDerivative = this.calculateFirstDerivative(recentValues);
    const secondDerivative = this.calculateSecondDerivative(firstDerivative);
    
    // 4. Refuerzo de características morfológicas utilizando derivadas
    // Para PPG, queremos enfatizar las pendientes de subida y puntos de inflexión
    let morphologicalEnhancement = 0;
    
    if (firstDerivative.length > 0 && secondDerivative.length > 0) {
      // Realce basado en pendiente positiva (subida) - característica principal del pulso PPG
      const risingEdgeFactor = Math.max(0, firstDerivative[firstDerivative.length - 1]);
      
      // Refuerzo basado en punto de inflexión (cambio de curvatura) - característica de forma
      const inflectionFactor = -Math.min(0, secondDerivative[secondDerivative.length - 1]);
      
      // Ponderación adaptativa basada en características morfológicas
      morphologicalEnhancement = 
        baselineFiltered * 0.85 + 
        risingEdgeFactor * 0.1 + 
        inflectionFactor * 0.05;
    } else {
      morphologicalEnhancement = baselineFiltered;
    }
    
    // 5. Filtrado final y normalización
    return morphologicalEnhancement;
  }
  
  /**
   * Nuevo: Detección de artefactos de movimiento basada en análisis de señal
   * Identifica patrones característicos de movimiento en la señal PPG
   */
  public detectMotionArtifact(value: number, accelerometerData?: {x: number, y: number, z: number}): boolean {
    // Actualizar buffer de artefactos
    this.motionArtifactBuffer.push(value);
    if (this.motionArtifactBuffer.length > this.MOTION_BUFFER_SIZE) {
      this.motionArtifactBuffer.shift();
    }
    
    // Si tenemos datos de acelerómetro, usarlos como primera línea de detección
    if (accelerometerData) {
      // Calcular magnitud de aceleración
      const magnitude = Math.sqrt(
        Math.pow(accelerometerData.x, 2) + 
        Math.pow(accelerometerData.y, 2) + 
        Math.pow(accelerometerData.z, 2)
      );
      
      // Umbral de movimiento significativo (adaptado a unidades típicas de acelerómetros móviles)
      const significantMotion = magnitude > 10.5; // Aprox. 1.05g (gravedad)
      
      if (significantMotion) {
        this.lastMotionArtifactTime = Date.now();
        this.motionCompensationActive = true;
        return true;
      }
    }
    
    // Si no tenemos suficientes datos, no podemos detectar artefactos
    if (this.motionArtifactBuffer.length < 10) {
      return false;
    }
    
    // Análisis basado únicamente en la señal PPG
    // 1. Calcular variación rápida (derivada)
    const recentValues = this.motionArtifactBuffer.slice(-5);
    const variations = [];
    for (let i = 1; i < recentValues.length; i++) {
      variations.push(Math.abs(recentValues[i] - recentValues[i-1]));
    }
    
    // 2. Calcular variación promedio
    const avgVariation = variations.reduce((sum, val) => sum + val, 0) / variations.length;
    
    // 3. Calcular variación histórica (para baseline)
    const historicVariation = this.calculateHistoricVariation();
    
    // 4. Detectar si la variación actual es significativamente mayor que la histórica
    const variationRatio = avgVariation / (historicVariation + 0.001); // Evitar división por cero
    const isMotionArtifact = variationRatio > this.MOTION_THRESHOLD;
    
    // 5. Si detectamos artefacto o estamos en periodo de recuperación
    if (isMotionArtifact) {
      this.lastMotionArtifactTime = Date.now();
      this.motionCompensationActive = true;
      return true;
    } else if (Date.now() - this.lastMotionArtifactTime < this.MOTION_RECOVERY_TIME) {
      // Todavía en periodo de recuperación
      return true;
    } else {
      this.motionCompensationActive = false;
      return false;
    }
  }
  
  /**
   * Calcular variación histórica para baseline de detección de movimiento
   */
  private calculateHistoricVariation(): number {
    if (this.motionArtifactBuffer.length < 10) {
      return 0.1; // Valor por defecto si no hay suficiente historial
    }
    
    const variations = [];
    const values = this.motionArtifactBuffer.slice(0, -5); // Usar valores más antiguos como referencia
    
    for (let i = 1; i < values.length; i++) {
      variations.push(Math.abs(values[i] - values[i-1]));
    }
    
    // Ordenar y tomar el percentil 75 para robustez
    variations.sort((a, b) => a - b);
    const p75Index = Math.floor(variations.length * 0.75);
    
    return variations[p75Index] || 0.1;
  }
  
  /**
   * Nuevo: Compensación de artefactos de movimiento usando ICA simplificado
   * Implementa una versión simplificada de Análisis de Componentes Independientes
   */
  public applyMotionCompensation(value: number): number {
    // Si no hay artefacto detectado, devolver el valor sin cambios
    if (!this.motionCompensationActive) {
      return value;
    }
    
    // Guardar el valor en múltiples componentes (simulando diferentes canales)
    // Para un ICA simplificado necesitamos al menos 2 componentes
    this.signalComponentsBuffer[0].push(value);
    // Segunda componente: valor con un retardo
    this.signalComponentsBuffer[1].push(
      this.signalComponentsBuffer[0].length > 2 ? 
      this.signalComponentsBuffer[0][this.signalComponentsBuffer[0].length - 2] : 
      value
    );
    // Tercera componente: tendencia suavizada
    const smoothedValue = this.signalComponentsBuffer[2].length > 0 ? 
      this.signalComponentsBuffer[2][this.signalComponentsBuffer[2].length - 1] * 0.8 + value * 0.2 : 
      value;
    this.signalComponentsBuffer[2].push(smoothedValue);
    
    // Limitar tamaño de los buffers
    for (let i = 0; i < this.signalComponentsBuffer.length; i++) {
      if (this.signalComponentsBuffer[i].length > this.ICA_BUFFER_SIZE) {
        this.signalComponentsBuffer[i].shift();
      }
    }
    
    // Si no tenemos suficientes muestras, devolver el valor suavizado
    if (this.signalComponentsBuffer[0].length < this.ICA_MIN_SAMPLES) {
      return smoothedValue;
    }
    
    // Implementar un ICA simplificado (en realidad una versión muy simplificada)
    // Calcular correlaciones entre componentes
    const corrMatrix = this.calculateCorrelationMatrix();
    
    // Identificar la componente menos correlacionada con las otras (probablemente la señal cardíaca)
    const correlationScores = [
      Math.abs(corrMatrix[0][1]) + Math.abs(corrMatrix[0][2]),
      Math.abs(corrMatrix[1][0]) + Math.abs(corrMatrix[1][2]),
      Math.abs(corrMatrix[2][0]) + Math.abs(corrMatrix[2][1])
    ];
    
    // La componente con menor score de correlación es probablemente la más independiente
    const minCorrelationIndex = correlationScores.indexOf(Math.min(...correlationScores));
    
    // Usar la componente más "independiente", pero mezclada con el valor actual para estabilidad
    const compensatedValue = this.signalComponentsBuffer[minCorrelationIndex][this.signalComponentsBuffer[minCorrelationIndex].length - 1] * 0.7 + value * 0.3;
    
    return compensatedValue;
  }
  
  /**
   * Calcular matriz de correlación entre las componentes
   */
  private calculateCorrelationMatrix(): number[][] {
    const matrix: number[][] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    
    // Calcular correlaciones cruzadas
    for (let i = 0; i < this.signalComponentsBuffer.length; i++) {
      for (let j = i + 1; j < this.signalComponentsBuffer.length; j++) {
        const correlation = this.calculateCorrelation(
          this.signalComponentsBuffer[i],
          this.signalComponentsBuffer[j]
        );
        matrix[i][j] = correlation;
        matrix[j][i] = correlation; // Matriz simétrica
      }
    }
    
    return matrix;
  }
  
  /**
   * Calcular correlación entre dos señales
   */
  private calculateCorrelation(signal1: number[], signal2: number[]): number {
    if (signal1.length < 3 || signal2.length < 3) return 0;
    
    // Usar solo los últimos N valores
    const n = Math.min(signal1.length, signal2.length, 15);
    const s1 = signal1.slice(-n);
    const s2 = signal2.slice(-n);
    
    // Calcular medias
    const mean1 = s1.reduce((sum, val) => sum + val, 0) / n;
    const mean2 = s2.reduce((sum, val) => sum + val, 0) / n;
    
    // Calcular covarianza y varianzas
    let covariance = 0;
    let variance1 = 0;
    let variance2 = 0;
    
    for (let i = 0; i < n; i++) {
      const diff1 = s1[i] - mean1;
      const diff2 = s2[i] - mean2;
      covariance += diff1 * diff2;
      variance1 += diff1 * diff1;
      variance2 += diff2 * diff2;
    }
    
    // Evitar división por cero
    if (variance1 === 0 || variance2 === 0) return 0;
    
    // Calcular correlación normalizada
    return covariance / Math.sqrt(variance1 * variance2);
  }
  
  /**
   * Nuevo: Procesamiento multiespectral para compensación de movimiento
   * Si hay disponibles múltiples longitudes de onda (rojo e IR), usa su ratio para mejor detección
   */
  public processMultiWavelength(redValue: number, irValue?: number): number {
    // Almacenar valores
    this.multiWavelengthBuffer.red.push(redValue);
    if (irValue !== undefined) {
      if (!this.multiWavelengthBuffer.ir) this.multiWavelengthBuffer.ir = [];
      this.multiWavelengthBuffer.ir.push(irValue);
    }
    
    // Limitar tamaño de buffers
    if (this.multiWavelengthBuffer.red.length > this.WAVELENGTH_BUFFER_SIZE) {
      this.multiWavelengthBuffer.red.shift();
      if (this.multiWavelengthBuffer.ir && this.multiWavelengthBuffer.ir.length > 0) {
        this.multiWavelengthBuffer.ir.shift();
      }
    }
    
    // Si no tenemos IR, devolver el valor rojo
    if (!this.multiWavelengthBuffer.ir || this.multiWavelengthBuffer.ir.length < 5) {
      return redValue;
    }
    
    // Calcular ratio R/IR para los últimos valores
    const lastRedValue = this.multiWavelengthBuffer.red[this.multiWavelengthBuffer.red.length - 1];
    const lastIrValue = this.multiWavelengthBuffer.ir[this.multiWavelengthBuffer.ir.length - 1];
    
    // Si algún valor es cercano a cero, evitar división
    if (Math.abs(lastIrValue) < 0.001) return lastRedValue;
    
    // Calcular ratio normalizado
    const ratio = lastRedValue / lastIrValue;
    
    // Detectar anomalías en el ratio que indiquen artefactos
    const ratioHistory = [];
    const n = Math.min(this.multiWavelengthBuffer.red.length, this.multiWavelengthBuffer.ir.length);
    
    for (let i = 0; i < n; i++) {
      if (Math.abs(this.multiWavelengthBuffer.ir[i]) > 0.001) {
        ratioHistory.push(this.multiWavelengthBuffer.red[i] / this.multiWavelengthBuffer.ir[i]);
      }
    }
    
    // Si no hay suficiente historial, devolver el valor original
    if (ratioHistory.length < 3) return redValue;
    
    // Calcular estadísticas del ratio
    ratioHistory.sort((a, b) => a - b);
    const medianRatio = ratioHistory[Math.floor(ratioHistory.length / 2)];
    
    // Si el ratio actual es muy diferente del histórico, podría ser un artefacto
    const ratioDifference = Math.abs(ratio - medianRatio) / medianRatio;
    
    if (ratioDifference > 0.3) { // Umbral de 30% de diferencia
      // Tenemos un artefacto - usar valor corregido
      return lastRedValue * (medianRatio / ratio);
    }
    
    // No hay artefacto detectado
    return redValue;
  }
  
  /**
   * Actualiza el historial para análisis morfológico
   */
  private updateMorphologicalHistory(value: number): void {
    // Mantener historial de valores para cálculos de derivada
    this.valueHistory.push(value);
    if (this.valueHistory.length > this.CARDIO_OPTICAL_WINDOW) {
      this.valueHistory.shift();
    }
    
    // Actualizar derivadas si hay suficientes valores
    if (this.valueHistory.length > this.DERIVATIVE_WINDOW) {
      const newDeriv = this.calculateSingleDerivative(this.valueHistory);
      this.derivativeHistory.push(newDeriv);
      
      if (this.derivativeHistory.length > this.DERIVATIVE_WINDOW) {
        this.derivativeHistory.shift();
      }
      
      // Actualizar segunda derivada si hay suficientes valores
      if (this.derivativeHistory.length > this.DERIVATIVE_WINDOW) {
        const newSecondDeriv = this.calculateSingleDerivative(this.derivativeHistory);
        this.secondDerivativeHistory.push(newSecondDeriv);
        
        if (this.secondDerivativeHistory.length > this.DERIVATIVE_WINDOW) {
          this.secondDerivativeHistory.shift();
        }
      }
    }
  }
  
  /**
   * Calcula la primera derivada de un conjunto de valores
   */
  private calculateFirstDerivative(values: number[]): number[] {
    const result: number[] = [];
    
    // Algoritmo de tres puntos para mejor precisión en PPG
    for (let i = 2; i < values.length - 2; i++) {
      const derivative = (values[i+1] - values[i-1]) / 2;
      result.push(derivative);
    }
    
    return result;
  }
  
  /**
   * Calcula la segunda derivada a partir de la primera
   */
  private calculateSecondDerivative(firstDerivative: number[]): number[] {
    const result: number[] = [];
    
    for (let i = 1; i < firstDerivative.length - 1; i++) {
      const derivative = firstDerivative[i+1] - firstDerivative[i-1];
      result.push(derivative);
    }
    
    return result;
  }
  
  /**
   * Calcula un solo valor de derivada a partir de un conjunto de valores
   */
  private calculateSingleDerivative(values: number[]): number {
    if (values.length < 3) return 0;
    
    // Usar los últimos valores para el cálculo
    const len = values.length;
    return (values[len-1] - values[len-3]) / 2;
  }
  
  /**
   * Nuevo: Filtrado completo con compensación de movimiento 
   * Aplica toda la cadena de procesamiento incluyendo detección y compensación de artefactos
   */
  public applyCompleteFilterWithMotionCompensation(
    value: number, 
    values: number[], 
    accelerometerData?: {x: number, y: number, z: number},
    irValue?: number
  ): {
    filteredValue: number;
    hasMotionArtifact: boolean;
    appliedCompensation: boolean;
  } {
    // 1. Detectar artefactos de movimiento
    const hasMotionArtifact = this.detectMotionArtifact(value, accelerometerData);
    
    let processedValue = value;
    let appliedCompensation = false;
    
    // 2. Si hay disponibles múltiples longitudes de onda, aplicar procesamiento
    if (irValue !== undefined) {
      processedValue = this.processMultiWavelength(value, irValue);
      appliedCompensation = true;
    }
    
    // 3. Si se detectó artefacto, aplicar compensación
    if (hasMotionArtifact) {
      processedValue = this.applyMotionCompensation(processedValue);
      appliedCompensation = true;
    }
    
    // 4. Aplicar el filtrado normal
    const filteredValue = this.applyCardioOpticalFilter(processedValue, values);
    
    return {
      filteredValue,
      hasMotionArtifact,
      appliedCompensation
    };
  }
  
  /**
   * Resetea los filtros que mantienen estado
   */
  public reset(): void {
    this.butterworthInputHistory = [0, 0];
    this.butterworthOutputHistory = [0, 0];
    this.valueHistory = [];
    this.derivativeHistory = [];
    this.secondDerivativeHistory = [];
    
    // Reiniciar nuevos buffers
    this.motionArtifactBuffer = [];
    this.motionCompensationActive = false;
    this.lastMotionArtifactTime = 0;
    this.signalComponentsBuffer = [[], [], []];
    this.multiWavelengthBuffer = {red: [], ir: []};
  }
}
