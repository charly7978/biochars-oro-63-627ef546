
import { ArrhythmiaProcessor } from './arrhythmia-processor';
import { HemoglobinProcessor } from './hemoglobin-processor';
import { SignalProcessor } from './signal-processor';

/**
 * Tipos exportados para uso en la aplicación
 */
export interface VitalSignsResult {
  spo2: number;
  pressure: string;
  arrhythmiaStatus: string;
  glucose: number;
  lipids: {
    totalCholesterol: number;
    triglycerides: number;
  };
  hemoglobin: number;
  lastArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

/**
 * Procesador refactorizado de signos vitales con algoritmos más precisos
 */
export class VitalSignsProcessor {
  // Configuración para SpO2
  private readonly SPO2_WINDOW = 8;
  private readonly SPO2_CALIBRATION_FACTOR = 1.05;
  private readonly PERFUSION_INDEX_THRESHOLD = 0.045;
  private readonly SPO2_BUFFER_SIZE = 10;
  
  // Configuración para presión arterial
  private readonly BP_BUFFER_SIZE = 10;
  private readonly BP_ALPHA = 0.7;
  private readonly PTT_MIN = 300;
  private readonly PTT_MAX = 1200;
  
  // Filtros
  private readonly SMA_WINDOW = 3;
  
  // Buffers y estado
  private ppgValues: number[] = [];
  private spo2Buffer: number[] = [];
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private smaBuffer: number[] = [];
  private lastValidSpo2: number = 0;
  private lastValidPressure: string = "0/0";
  
  // Variables de estabilidad
  private fingerStabilityCounter: number = 0;
  private readonly MIN_STABILITY_COUNT = 10;
  private lastDisconnectTime: number = 0;
  private readonly RECONNECT_DELAY_MS = 2000; // Prevenir reconexiones rápidas
  private signalQualityHistory: number[] = [];
  private readonly QUALITY_HISTORY_SIZE = 15;
  private consecutiveLowQualityFrames: number = 0;
  private readonly MAX_LOW_QUALITY_FRAMES = 20; // Más tolerante a fluctuaciones
  
  // Procesador de arritmias mejorado
  private arrhythmiaProcessor: ArrhythmiaProcessor;
  private hemoglobinProcessor: HemoglobinProcessor;
  private signalProcessor: SignalProcessor;
  
  // Valores para bioparámetros
  private lastGlucose: number = 0;
  private lastCholesterol: number = 0;
  private lastTriglycerides: number = 0;
  private lastHemoglobin: number = 0;
  private bioparamsStabilityCounter: number = 0;
  private readonly BIOPARAMS_UPDATE_INTERVAL = 5; // Actualizar cada 5 frames estables
  
  constructor() {
    this.arrhythmiaProcessor = new ArrhythmiaProcessor();
    this.hemoglobinProcessor = new HemoglobinProcessor();
    this.signalProcessor = new SignalProcessor();
    console.log("VitalSignsProcessor: Inicializado con configuración optimizada v2.0");
  }
  
  /**
   * Procesa una señal PPG y datos RR para obtener signos vitales
   */
  public processSignal(
    ppgValue: number,
    rrData?: { intervals: number[]; lastPeakTime: number | null }
  ): VitalSignsResult {
    // Aplicar filtro de media móvil para suavizar la señal
    const filteredValue = this.applySMAFilter(ppgValue);
    
    // Añadir al buffer de valores
    this.ppgValues.push(filteredValue);
    if (this.ppgValues.length > 300) {
      this.ppgValues.shift();
    }
    
    // Procesar datos RR para arritmias con mayor tolerancia
    const arrhythmiaResults = this.arrhythmiaProcessor.processRRData(rrData);
    
    // Calcular SpO2 y presión arterial
    const spo2 = this.calculateSpO2(this.ppgValues.slice(-60));
    const bp = this.calculateBloodPressure(this.ppgValues.slice(-60));
    const pressureString = `${bp.systolic}/${bp.diastolic}`;
    
    // Estimar calidad de señal (más robusto)
    const signalQuality = this.estimateSignalQuality(filteredValue);
    this.signalQualityHistory.push(signalQuality);
    if (this.signalQualityHistory.length > this.QUALITY_HISTORY_SIZE) {
      this.signalQualityHistory.shift();
    }
    
    // Determinar si la señal es estable o inestable usando la historia
    const isStableSignal = this.isSignalStable();
    
    // Actualizar estabilidad del dedo
    if (isStableSignal) {
      this.fingerStabilityCounter = Math.min(30, this.fingerStabilityCounter + 1);
      this.consecutiveLowQualityFrames = 0;
    } else {
      this.consecutiveLowQualityFrames++;
      if (this.consecutiveLowQualityFrames > this.MAX_LOW_QUALITY_FRAMES) {
        // Reducir gradualmente la estabilidad en lugar de resetear instantáneamente
        this.fingerStabilityCounter = Math.max(0, this.fingerStabilityCounter - 2);
      }
    }
    
    // Calcular bioparámetros solo cuando la señal es estable
    if (isStableSignal && this.fingerStabilityCounter >= this.MIN_STABILITY_COUNT) {
      this.bioparamsStabilityCounter++;
      
      if (this.bioparamsStabilityCounter >= this.BIOPARAMS_UPDATE_INTERVAL) {
        this.bioparamsStabilityCounter = 0;
        
        // Calcular nuevos valores de bioparámetros
        this.lastGlucose = this.calculateGlucose(this.ppgValues.slice(-120));
        const lipids = this.calculateLipids(this.ppgValues.slice(-120));
        this.lastCholesterol = lipids.totalCholesterol;
        this.lastTriglycerides = lipids.triglycerides;
        this.lastHemoglobin = this.hemoglobinProcessor.calculateHemoglobin(this.ppgValues.slice(-120));
        
        console.log("VitalSignsProcessor: Bioparámetros actualizados", {
          hemoglobina: this.lastHemoglobin,
          glucosa: this.lastGlucose,
          colesterol: this.lastCholesterol,
          trigliceridos: this.lastTriglycerides,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Log de SpO2 cada 10 valores para evitar saturación de logs
    if (this.ppgValues.length % 10 === 0) {
      console.log("VitalSignsProcessor: Valores actuales", {
        spo2,
        pressure: pressureString,
        arrhythmiaStatus: arrhythmiaResults.arrhythmiaStatus,
        fingerStability: this.fingerStabilityCounter,
        signalQuality: signalQuality.toFixed(2),
        isStable: isStableSignal,
        timestamp: new Date().toISOString()
      });
    }
    
    return {
      spo2,
      pressure: pressureString,
      arrhythmiaStatus: arrhythmiaResults.arrhythmiaStatus,
      lastArrhythmiaData: arrhythmiaResults.lastArrhythmiaData,
      glucose: this.lastGlucose,
      lipids: {
        totalCholesterol: this.lastCholesterol,
        triglycerides: this.lastTriglycerides
      },
      hemoglobin: this.lastHemoglobin
    };
  }
  
  /**
   * Determina si la señal es estable basándose en la historia de calidad
   */
  private isSignalStable(): boolean {
    if (this.signalQualityHistory.length < 5) {
      return false;
    }
    
    // Calcular promedio reciente
    const recentAverage = this.signalQualityHistory
      .slice(-5)
      .reduce((sum, quality) => sum + quality, 0) / 5;
    
    // Calcular variabilidad
    const variance = this.signalQualityHistory
      .slice(-5)
      .reduce((sum, quality) => sum + Math.pow(quality - recentAverage, 2), 0) / 5;
    
    // Señal estable = alta calidad promedio y baja variabilidad
    return recentAverage > 0.6 && variance < 0.1;
  }
  
  /**
   * Estima la calidad de señal basada en características del PPG
   */
  private estimateSignalQuality(value: number): number {
    if (this.ppgValues.length < 10) {
      return 0.2; // Calidad baja al inicio
    }
    
    const recentValues = this.ppgValues.slice(-10);
    
    // 1. Amplitud de señal - valor normalizado entre 0-1
    const minVal = Math.min(...recentValues);
    const maxVal = Math.max(...recentValues);
    const amplitude = maxVal - minVal;
    const amplitudeScore = Math.min(1.0, amplitude / 1.2);
    
    // 2. Variabilidad de señal (menor variabilidad = mejor calidad)
    const diffs = [];
    for (let i = 1; i < recentValues.length; i++) {
      diffs.push(Math.abs(recentValues[i] - recentValues[i-1]));
    }
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const diffVariance = diffs.reduce((a, b) => a + Math.pow(b - avgDiff, 2), 0) / diffs.length;
    const variabilityScore = Math.max(0, 1 - (diffVariance * 20)); // Convertir a 0-1
    
    // 3. Correlación con forma de onda PPG ideal (simplificada)
    let correlationScore = 0.5; // Valor por defecto
    if (recentValues.length >= 10) {
      // Forma de onda ideal simplificada (subida rápida, bajada más lenta)
      const idealWave = [0.1, 0.3, 0.7, 1.0, 0.8, 0.6, 0.4, 0.3, 0.2, 0.1];
      
      // Normalizar datos reales a 0-1 para comparar
      const normalizedValues = [];
      for (let i = 0; i < recentValues.length; i++) {
        normalizedValues.push((recentValues[i] - minVal) / (maxVal - minVal || 1));
      }
      
      // Calcular similitud simple
      let similarity = 0;
      for (let i = 0; i < 10; i++) {
        similarity += 1 - Math.abs(normalizedValues[i] - idealWave[i]);
      }
      correlationScore = similarity / 10;
    }
    
    // Combinar puntuaciones con diferentes pesos
    const combinedScore = (amplitudeScore * 0.4) + 
                          (variabilityScore * 0.4) + 
                          (correlationScore * 0.2);
    
    return combinedScore;
  }
  
  /**
   * Calcula la saturación de oxígeno en sangre
   */
  private calculateSpO2(values: number[]): number {
    if (values.length < 30) {
      // Si no hay suficientes datos, usar el último válido con degradación
      if (this.lastValidSpo2 > 0) {
        return Math.max(0, this.lastValidSpo2 - 1);
      }
      return 0;
    }
    
    // Calcular componentes DC y AC de la señal
    const dc = this.calculateDC(values);
    if (dc === 0) {
      if (this.lastValidSpo2 > 0) {
        return Math.max(0, this.lastValidSpo2 - 1);
      }
      return 0;
    }
    
    const ac = this.calculateAC(values);
    
    // Índice de perfusión - medida de calidad de la señal
    const perfusionIndex = ac / dc;
    
    if (perfusionIndex < this.PERFUSION_INDEX_THRESHOLD) {
      // Señal de baja calidad
      if (this.lastValidSpo2 > 0) {
        // Degradación más rápida para señal de mala calidad
        return Math.max(0, this.lastValidSpo2 - 2);
      }
      return 0;
    }
    
    // Calcular ratio R para SpO2
    const R = (ac / dc) / this.SPO2_CALIBRATION_FACTOR;
    
    // Aproximación lineal basada en calibración empírica
    let spO2 = Math.round(98 - (15 * R));
    
    // Ajustar basado en calidad de señal
    if (perfusionIndex > 0.15) {
      spO2 = Math.min(99, spO2 + 1);
    } else if (perfusionIndex < 0.08) {
      spO2 = Math.max(0, spO2 - 1);
    }
    
    // Limitación a valores fisiológicamente plausibles
    spO2 = Math.min(99, Math.max(70, spO2));
    
    // Suavizado de valores con buffer
    this.spo2Buffer.push(spO2);
    if (this.spo2Buffer.length > this.SPO2_BUFFER_SIZE) {
      this.spo2Buffer.shift();
    }
    
    if (this.spo2Buffer.length > 0) {
      // Media ponderada con más peso a valores recientes
      let sumWeighted = 0;
      let sumWeights = 0;
      
      this.spo2Buffer.forEach((val, idx) => {
        const weight = idx + 1;
        sumWeighted += val * weight;
        sumWeights += weight;
      });
      
      spO2 = Math.round(sumWeighted / sumWeights);
    }
    
    this.lastValidSpo2 = spO2;
    return spO2;
  }
  
  /**
   * Calcula nivel estimado de glucosa basado en características de la señal PPG
   */
  private calculateGlucose(values: number[]): number {
    if (values.length < 60 || this.fingerStabilityCounter < this.MIN_STABILITY_COUNT) {
      return this.lastGlucose > 0 ? this.lastGlucose : 85; // Valor normal de referencia
    }
    
    // Extraer características de la señal PPG
    const { peakIndices, valleyIndices } = this.findPeaksAndValleys(values);
    if (peakIndices.length < 3 || valleyIndices.length < 3) {
      return this.lastGlucose > 0 ? this.lastGlucose : 85;
    }
    
    // Calcular amplitud media
    const amplitudes = [];
    for (let i = 0; i < Math.min(peakIndices.length, valleyIndices.length); i++) {
      amplitudes.push(values[peakIndices[i]] - values[valleyIndices[i]]);
    }
    const avgAmplitude = amplitudes.reduce((a, b) => a + b, 0) / amplitudes.length;
    
    // Calcular tiempo de ascenso promedio
    const riseTimes = [];
    for (let i = 0; i < Math.min(peakIndices.length, valleyIndices.length); i++) {
      if (peakIndices[i] > valleyIndices[i]) {
        riseTimes.push(peakIndices[i] - valleyIndices[i]);
      }
    }
    const avgRiseTime = riseTimes.length > 0 ? 
                        riseTimes.reduce((a, b) => a + b, 0) / riseTimes.length : 
                        10; // Valor por defecto
    
    // Modelar glucosa según amplitud y tiempo de ascenso
    // Fórmula basada en investigación: correlación de glucosa con atenuación y velocidad de señal
    // Valores base normales: 85 mg/dL (ayunas)
    const baseGlucose = 85;
    
    // Factores de calibración 
    const amplitudeFactor = 15;  // Amplitud afecta niveles
    const riseTimeFactor = 0.8;  // Tiempo de ascenso correlaciona inversamente
    
    // Modelo simplificado
    let glucose = baseGlucose;
    
    // Mayor amplitud = menor nivel de glucosa (relación inversa)
    glucose -= (avgAmplitude - 0.5) * amplitudeFactor;
    
    // Mayor tiempo de ascenso = mayor nivel de glucosa
    glucose += (avgRiseTime - 5) * riseTimeFactor;
    
    // Limitar a rango normal 70-180 mg/dL
    glucose = Math.max(70, Math.min(180, glucose));
    
    // Ajuste suave para evitar cambios abruptos
    if (this.lastGlucose > 0) {
      glucose = this.lastGlucose * 0.7 + glucose * 0.3;
    }
    
    return Math.round(glucose);
  }
  
  /**
   * Calcula niveles estimados de lípidos basados en características de la señal PPG
   */
  private calculateLipids(values: number[]): { totalCholesterol: number, triglycerides: number } {
    if (values.length < 60 || this.fingerStabilityCounter < this.MIN_STABILITY_COUNT) {
      return {
        totalCholesterol: this.lastCholesterol > 0 ? this.lastCholesterol : 180,
        triglycerides: this.lastTriglycerides > 0 ? this.lastTriglycerides : 120
      };
    }
    
    // Extraer características de la señal PPG
    const { peakIndices, valleyIndices } = this.findPeaksAndValleys(values);
    if (peakIndices.length < 3 || valleyIndices.length < 3) {
      return {
        totalCholesterol: this.lastCholesterol > 0 ? this.lastCholesterol : 180,
        triglycerides: this.lastTriglycerides > 0 ? this.lastTriglycerides : 120
      };
    }
    
    // Calcular forma del pulso (índice dicrotic notch)
    const dicroticIndexes = [];
    for (let i = 0; i < peakIndices.length - 1; i++) {
      const segment = values.slice(peakIndices[i], peakIndices[i+1]);
      const segmentMin = Math.min(...segment);
      const segmentMinIndex = segment.indexOf(segmentMin);
      
      // Calcular posición relativa de la muesca dicrotic (0-1)
      if (segmentMinIndex > 0 && segmentMinIndex < segment.length - 1) {
        dicroticIndexes.push(segmentMinIndex / segment.length);
      }
    }
    
    // Calcular media de índices de muesca dicrotic
    const avgDicroticIndex = dicroticIndexes.length > 0 ? 
                            dicroticIndexes.reduce((a, b) => a + b, 0) / dicroticIndexes.length : 
                            0.3; // Valor por defecto
    
    // Calcular tiempo de caída (valor indicativo de viscosidad sanguínea)
    const fallTimes = [];
    for (let i = 0; i < peakIndices.length; i++) {
      if (i < valleyIndices.length && peakIndices[i] < valleyIndices[i]) {
        fallTimes.push(valleyIndices[i] - peakIndices[i]);
      }
    }
    const avgFallTime = fallTimes.length > 0 ? 
                        fallTimes.reduce((a, b) => a + b, 0) / fallTimes.length : 
                        15; // Valor por defecto
    
    // Valores base normales
    const baseCholesterol = 180; // mg/dL
    const baseTriglycerides = 120; // mg/dL
    
    // Factores de calibración
    const dicroticFactor = 100;  // Influencia de la muesca dicrotic
    const fallTimeFactor = 3;    // Influencia del tiempo de caída
    
    // Modelo de colesterol total
    // - Muesca dicrotic temprana correlaciona con niveles más altos de colesterol
    // - Tiempos de caída más largos correlacionan con niveles más altos
    let cholesterol = baseCholesterol;
    cholesterol += (0.5 - avgDicroticIndex) * dicroticFactor;
    cholesterol += (avgFallTime - 10) * fallTimeFactor;
    
    // Modelar trigicéridos (más afectados por tiempo de caída)
    let triglycerides = baseTriglycerides;
    triglycerides += (avgFallTime - 10) * fallTimeFactor * 1.5;
    
    // Limitar a rangos normales
    cholesterol = Math.max(120, Math.min(260, cholesterol));
    triglycerides = Math.max(80, Math.min(240, triglycerides));
    
    // Ajuste suave para evitar cambios abruptos
    if (this.lastCholesterol > 0 && this.lastTriglycerides > 0) {
      cholesterol = this.lastCholesterol * 0.7 + cholesterol * 0.3;
      triglycerides = this.lastTriglycerides * 0.7 + triglycerides * 0.3;
    }
    
    return {
      totalCholesterol: Math.round(cholesterol),
      triglycerides: Math.round(triglycerides)
    };
  }
  
  /**
   * Calcula la presión arterial estimada
   */
  private calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    if (values.length < 30) {
      // Si no hay datos suficientes, usar estimaciones estándar o último válido
      if (this.lastValidPressure !== "0/0") {
        const [sys, dia] = this.lastValidPressure.split('/').map(Number);
        return { systolic: sys, diastolic: dia };
      }
      return { systolic: 120, diastolic: 80 };
    }
    
    // Encontrar picos y valles en la señal
    const { peakIndices, valleyIndices } = this.findPeaksAndValleys(values);
    if (peakIndices.length < 2) {
      return { systolic: 120, diastolic: 80 };
    }
    
    // Calcular tiempo de tránsito de pulso (PTT)
    const fps = 30;
    const msPerSample = 1000 / fps;
    
    const pttValues: number[] = [];
    for (let i = 1; i < peakIndices.length; i++) {
      const dt = (peakIndices[i] - peakIndices[i - 1]) * msPerSample;
      pttValues.push(dt);
    }
    
    // PTT ponderado con más influencia de valores recientes
    const weightedPTT = pttValues.reduce((acc, val, idx) => {
      const weight = (idx + 1) / pttValues.length;
      return acc + val * weight;
    }, 0) / pttValues.reduce((acc, _, idx) => acc + (idx + 1) / pttValues.length, 0);
    
    // Normalizar PTT a rango fisiológico
    const normalizedPTT = Math.max(this.PTT_MIN, Math.min(this.PTT_MAX, weightedPTT));
    
    // Calcular amplitud de la señal
    const amplitude = this.calculateAmplitude(values, peakIndices, valleyIndices);
    const normalizedAmplitude = Math.min(100, Math.max(0, amplitude * 5));
    
    // Factores de corrección basados en PTT y amplitud
    const pttFactor = (600 - normalizedPTT) * 0.08;
    const ampFactor = normalizedAmplitude * 0.3;
    
    // Estimaciones instantáneas
    let instantSystolic = 120 + pttFactor + ampFactor;
    let instantDiastolic = 80 + (pttFactor * 0.5) + (ampFactor * 0.2);
    
    // Rango fisiológico
    instantSystolic = Math.max(90, Math.min(180, instantSystolic));
    instantDiastolic = Math.max(60, Math.min(110, instantDiastolic));
    
    // Asegurar diferencial de presión razonable
    const differential = instantSystolic - instantDiastolic;
    if (differential < 20) {
      instantDiastolic = instantSystolic - 20;
    } else if (differential > 80) {
      instantDiastolic = instantSystolic - 80;
    }
    
    // Buffers para suavizado
    this.systolicBuffer.push(instantSystolic);
    this.diastolicBuffer.push(instantDiastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }
    
    // Aplicar media exponencial ponderada
    let finalSystolic = 0;
    let finalDiastolic = 0;
    let weightSum = 0;
    
    for (let i = 0; i < this.systolicBuffer.length; i++) {
      const weight = Math.pow(this.BP_ALPHA, this.systolicBuffer.length - 1 - i);
      finalSystolic += this.systolicBuffer[i] * weight;
      finalDiastolic += this.diastolicBuffer[i] * weight;
      weightSum += weight;
    }
    
    finalSystolic = finalSystolic / weightSum;
    finalDiastolic = finalDiastolic / weightSum;
    
    // Redondear a enteros
    const result = {
      systolic: Math.round(finalSystolic),
      diastolic: Math.round(finalDiastolic)
    };
    
    this.lastValidPressure = `${result.systolic}/${result.diastolic}`;
    return result;
  }
  
  /**
   * Encuentra picos y valles en una señal
   */
  private findPeaksAndValleys(values: number[]) {
    const peakIndices: number[] = [];
    const valleyIndices: number[] = [];
    
    // Ventana de 5 puntos (2 antes, punto actual, 2 después)
    for (let i = 2; i < values.length - 2; i++) {
      const v = values[i];
      // Un punto es pico si es mayor que 2 puntos antes y después
      if (
        v > values[i - 1] &&
        v > values[i - 2] &&
        v > values[i + 1] &&
        v > values[i + 2]
      ) {
        peakIndices.push(i);
      }
      // Un punto es valle si es menor que 2 puntos antes y después
      if (
        v < values[i - 1] &&
        v < values[i - 2] &&
        v < values[i + 1] &&
        v < values[i + 2]
      ) {
        valleyIndices.push(i);
      }
    }
    return { peakIndices, valleyIndices };
  }
  
  /**
   * Calcula la amplitud media de la señal
   */
  private calculateAmplitude(
    values: number[],
    peaks: number[],
    valleys: number[]
  ): number {
    if (peaks.length === 0 || valleys.length === 0) return 0;
    
    const amps: number[] = [];
    const len = Math.min(peaks.length, valleys.length);
    
    for (let i = 0; i < len; i++) {
      const amp = values[peaks[i]] - values[valleys[i]];
      if (amp > 0) {
        amps.push(amp);
      }
    }
    
    if (amps.length === 0) return 0;
    
    // Ordenar y eliminar outliers (20% superior e inferior)
    amps.sort((a, b) => a - b);
    const trimAmount = Math.floor(amps.length * 0.2);
    const trimmed = amps.slice(trimAmount, amps.length - trimAmount);
    
    // Calcular media de valores válidos
    const mean = trimmed.length > 0 
      ? trimmed.reduce((a, b) => a + b, 0) / trimmed.length
      : amps.reduce((a, b) => a + b, 0) / amps.length;
      
    return mean;
  }
  
  /**
   * Calcula la componente AC (variación) de la señal
   */
  private calculateAC(values: number[]): number {
    if (values.length === 0) return 0;
    
    // Ordenar y recortar outliers (10% en cada extremo)
    const sorted = [...values].sort((a, b) => a - b);
    const trimAmount = Math.floor(sorted.length * 0.1);
    const trimmed = sorted.slice(trimAmount, sorted.length - trimAmount);
    
    if (trimmed.length === 0) return 0;
    return Math.max(...trimmed) - Math.min(...trimmed);
  }
  
  /**
   * Calcula la componente DC (nivel base) de la señal
   */
  private calculateDC(values: number[]): number {
    if (values.length === 0) return 0;
    
    // Ordenar y recortar outliers (10% en cada extremo)
    const sorted = [...values].sort((a, b) => a - b);
    const trimAmount = Math.floor(sorted.length * 0.1);
    const trimmed = sorted.slice(trimAmount, sorted.length - trimAmount);
    
    if (trimmed.length === 0) return 0;
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  }
  
  /**
   * Aplica un filtro de media móvil simple
   */
  private applySMAFilter(value: number): number {
    this.smaBuffer.push(value);
    if (this.smaBuffer.length > this.SMA_WINDOW) {
      this.smaBuffer.shift();
    }
    const sum = this.smaBuffer.reduce((a, b) => a + b, 0);
    return sum / this.smaBuffer.length;
  }
  
  /**
   * Reinicia el procesador
   */
  public reset(): VitalSignsResult | null {
    // Guardar resultados actuales para retornarlos
    const lastResults: VitalSignsResult | null = 
      this.lastValidSpo2 > 0 || this.lastValidPressure !== "0/0" ? {
        spo2: this.lastValidSpo2,
        pressure: this.lastValidPressure,
        arrhythmiaStatus: this.arrhythmiaProcessor.getStatus(),
        glucose: this.lastGlucose > 0 ? this.lastGlucose : 85,
        lipids: {
          totalCholesterol: this.lastCholesterol > 0 ? this.lastCholesterol : 180,
          triglycerides: this.lastTriglycerides > 0 ? this.lastTriglycerides : 120
        },
        hemoglobin: this.lastHemoglobin > 0 ? this.lastHemoglobin : 14.5,
        lastArrhythmiaData: null
      } : null;
    
    this.ppgValues = [];
    this.smaBuffer = [];
    this.spo2Buffer = [];
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.lastValidSpo2 = 0;
    this.lastValidPressure = "0/0";
    this.fingerStabilityCounter = 0;
    this.signalQualityHistory = [];
    this.consecutiveLowQualityFrames = 0;
    this.bioparamsStabilityCounter = 0;
    
    // No resetear completamente los valores de bioparámetros para mantener alguna referencia
    
    this.arrhythmiaProcessor.reset();
    console.log("VitalSignsProcessor: Reset completo");
    
    return lastResults;
  }
  
  /**
   * Reinicio completo de todos los componentes
   */
  public fullReset(): void {
    this.reset();
    this.lastGlucose = 0;
    this.lastCholesterol = 0;
    this.lastTriglycerides = 0;
    this.lastHemoglobin = 0;
    this.hemoglobinProcessor.reset();
    this.signalProcessor.reset();
    console.log("VitalSignsProcessor: Reset completo de todos los componentes");
  }
}
