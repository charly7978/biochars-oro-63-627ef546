
export interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  map?: number;
  confidence?: number;
}

export class BloodPressureAnalyzer {
  // Parámetros unificados para consistencia
  private readonly BP_BUFFER_SIZE = 15;
  private readonly MEDIAN_WEIGHT = 0.6;
  private readonly MEAN_WEIGHT = 0.4;
  
  // Límites fisiológicos
  private readonly MIN_SYSTOLIC = 90;
  private readonly MAX_SYSTOLIC = 170;
  private readonly MIN_DIASTOLIC = 60;
  private readonly MAX_DIASTOLIC = 100;
  private readonly MIN_PULSE_PRESSURE = 30;
  private readonly MAX_PULSE_PRESSURE = 60;
  
  // Umbrales de calidad
  private readonly MIN_SIGNAL_AMPLITUDE = 0.03;
  private readonly MIN_PEAK_COUNT = 4;
  private readonly MIN_FPS = 20;
  
  // Estado
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private calibrationFactor: number = 1.0;
  private isCalibrated: boolean = false;
  
  constructor() {
    this.reset();
  }
  
  public calculateBloodPressure(values: number[]): BloodPressureResult {
    // Validar calidad de datos
    if (values.length < 30) {
      return this.getDefaultValues();
    }
    
    // Encontrar picos y valles
    const { peakIndices, valleyIndices } = this.findPeaksAndValleys(values);
    
    if (peakIndices.length < this.MIN_PEAK_COUNT || valleyIndices.length < this.MIN_PEAK_COUNT) {
      return this.getDefaultValues();
    }
    
    // Calcular amplitud (proxy para presión de pulso)
    const amplitude = this.calculateAmplitude(values, peakIndices, valleyIndices);
    
    if (amplitude < this.MIN_SIGNAL_AMPLITUDE) {
      return this.getDefaultValues();
    }
    
    // Calcular características significativas de presión arterial
    const { 
      averagePeakWidth,
      peakToValleyRatio,
      dicroticNotchPosition,
      timeToMaxSlope
    } = this.extractFeatures(values, peakIndices, valleyIndices);
    
    // Calcular estimación inicial (presión sistólica)
    const pttFactor = timeToMaxSlope * 0.8; // Tiempo al máximo cambio
    const ampFactor = amplitude * 150; // Factor de amplitud
    
    // Estimar presión sistólica
    let instantSystolic = 120 - pttFactor + ampFactor * 0.2;
    
    // Estimar presión diastólica basada en relación empírica
    let instantDiastolic = 75 + (pttFactor * 0.55) + (amplitude * 15);
    
    // Aplicar límites fisiológicos
    instantSystolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, instantSystolic));
    instantDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, instantDiastolic));
    
    // Mantener diferencial de presión fisiológicamente válido
    const differential = instantSystolic - instantDiastolic;
    if (differential < this.MIN_PULSE_PRESSURE) {
      instantDiastolic = instantSystolic - this.MIN_PULSE_PRESSURE;
    } else if (differential > this.MAX_PULSE_PRESSURE) {
      instantDiastolic = instantSystolic - this.MAX_PULSE_PRESSURE;
    }
    
    // Verificar nuevamente límites fisiológicos
    instantDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, instantDiastolic));
    
    // Aplicar factor de calibración si está disponible
    if (this.isCalibrated) {
      instantSystolic *= this.calibrationFactor;
      instantDiastolic *= this.calibrationFactor;
    }
    
    // Actualizar buffers
    this.systolicBuffer.push(instantSystolic);
    this.diastolicBuffer.push(instantDiastolic);
    
    // Mantener tamaño de buffer
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }
    
    // Combinar mediana y promedio para estabilidad
    const systolic = this.getStabilizedValue(this.systolicBuffer);
    const diastolic = this.getStabilizedValue(this.diastolicBuffer);
    
    // Calcular MAP (Presión Arterial Media)
    const map = diastolic + (systolic - diastolic) / 3;
    
    // Calcular confianza basado en estabilidad
    const confidence = Math.min(100, 
      50 + // Base
      (this.isCalibrated ? 20 : 0) + // Si está calibrado
      Math.min(20, this.systolicBuffer.length * 2) + // Cantidad de muestras
      Math.min(10, peakIndices.length * 2) // Cantidad de picos detectados
    );
    
    return {
      systolic: Math.round(systolic),
      diastolic: Math.round(diastolic),
      map: Math.round(map),
      confidence
    };
  }
  
  private getStabilizedValue(buffer: number[]): number {
    if (buffer.length === 0) return 0;
    
    // Obtener mediana
    const sorted = [...buffer].sort((a, b) => a - b);
    const medianIndex = Math.floor(buffer.length / 2);
    const median = buffer.length % 2 === 0
      ? (sorted[medianIndex - 1] + sorted[medianIndex]) / 2
      : sorted[medianIndex];
    
    // Obtener promedio
    const mean = buffer.reduce((sum, val) => sum + val, 0) / buffer.length;
    
    // Combinar ponderadamente
    return median * this.MEDIAN_WEIGHT + mean * this.MEAN_WEIGHT;
  }
  
  private findPeaksAndValleys(values: number[]): { 
    peakIndices: number[]; 
    valleyIndices: number[];
  } {
    const peakIndices: number[] = [];
    const valleyIndices: number[] = [];
    
    // Usar algoritmo de detección de extremos locales
    for (let i = 1; i < values.length - 1; i++) {
      // Detectar picos
      if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
        peakIndices.push(i);
      }
      // Detectar valles
      else if (values[i] < values[i - 1] && values[i] < values[i + 1]) {
        valleyIndices.push(i);
      }
    }
    
    return { peakIndices, valleyIndices };
  }
  
  private calculateAmplitude(
    values: number[],
    peakIndices: number[],
    valleyIndices: number[]
  ): number {
    if (peakIndices.length === 0 || valleyIndices.length === 0) {
      return 0;
    }
    
    // Calcular amplitud media
    let totalAmplitude = 0;
    let count = 0;
    
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIndex = peakIndices[i];
      
      // Encontrar valle más cercano antes del pico
      let closestValleyIndex = -1;
      let minDistance = Infinity;
      
      for (let j = 0; j < valleyIndices.length; j++) {
        const valleyIndex = valleyIndices[j];
        if (valleyIndex < peakIndex) {
          const distance = peakIndex - valleyIndex;
          if (distance < minDistance) {
            minDistance = distance;
            closestValleyIndex = valleyIndex;
          }
        }
      }
      
      if (closestValleyIndex !== -1) {
        const peakValue = values[peakIndex];
        const valleyValue = values[closestValleyIndex];
        totalAmplitude += peakValue - valleyValue;
        count++;
      }
    }
    
    return count > 0 ? totalAmplitude / count : 0;
  }
  
  private extractFeatures(
    values: number[],
    peakIndices: number[],
    valleyIndices: number[]
  ): {
    averagePeakWidth: number;
    peakToValleyRatio: number;
    dicroticNotchPosition: number;
    timeToMaxSlope: number;
  } {
    // Valores por defecto
    let averagePeakWidth = 0;
    let peakToValleyRatio = 0;
    let dicroticNotchPosition = 0;
    let timeToMaxSlope = 0;
    
    if (peakIndices.length === 0 || valleyIndices.length === 0) {
      return {
        averagePeakWidth,
        peakToValleyRatio,
        dicroticNotchPosition,
        timeToMaxSlope
      };
    }
    
    // Calcular ancho de pico promedio
    let totalWidth = 0;
    let widthCount = 0;
    
    for (let i = 0; i < peakIndices.length - 1; i++) {
      totalWidth += peakIndices[i + 1] - peakIndices[i];
      widthCount++;
    }
    
    averagePeakWidth = widthCount > 0 ? totalWidth / widthCount : 0;
    
    // Calcular relación pico/valle
    let totalRatio = 0;
    let ratioCount = 0;
    
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIndex = peakIndices[i];
      const peakValue = values[peakIndex];
      
      // Encontrar valle más cercano antes del pico
      let closestValleyIndex = -1;
      let minDistance = Infinity;
      
      for (let j = 0; j < valleyIndices.length; j++) {
        const valleyIndex = valleyIndices[j];
        if (valleyIndex < peakIndex) {
          const distance = peakIndex - valleyIndex;
          if (distance < minDistance) {
            minDistance = distance;
            closestValleyIndex = valleyIndex;
          }
        }
      }
      
      if (closestValleyIndex !== -1) {
        const valleyValue = values[closestValleyIndex];
        if (valleyValue !== 0) {
          totalRatio += peakValue / valleyValue;
          ratioCount++;
        }
      }
    }
    
    peakToValleyRatio = ratioCount > 0 ? totalRatio / ratioCount : 0;
    
    // Calcular tiempo al máximo cambio (pendiente)
    let maxSlope = 0;
    let maxSlopeIndex = 0;
    
    for (let i = 1; i < values.length; i++) {
      const slope = values[i] - values[i - 1];
      if (slope > maxSlope) {
        maxSlope = slope;
        maxSlopeIndex = i;
      }
    }
    
    // Normalizar a 0-1
    timeToMaxSlope = maxSlopeIndex / values.length;
    
    return {
      averagePeakWidth,
      peakToValleyRatio,
      dicroticNotchPosition,
      timeToMaxSlope
    };
  }
  
  public calibrate(referenceValues: { systolic: number; diastolic: number }): void {
    if (this.systolicBuffer.length === 0) return;
    
    const currentSystolic = this.getStabilizedValue(this.systolicBuffer);
    
    if (currentSystolic > 0) {
      this.calibrationFactor = referenceValues.systolic / currentSystolic;
      this.isCalibrated = true;
    }
  }
  
  public getDefaultValues(): BloodPressureResult {
    return {
      systolic: 0,
      diastolic: 0,
      map: 0,
      confidence: 0
    };
  }
  
  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.calibrationFactor = 1.0;
    this.isCalibrated = false;
  }
}
