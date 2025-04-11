import { calculateAmplitude, findPeaksAndValleys } from './utils';

export class BloodPressureProcessor {
  private readonly BP_BUFFER_SIZE = 150; // 5 segundos a 30Hz - reducido para mayor sensibilidad
  private readonly MIN_SAMPLES = 30; // 1 segundo de datos mínimo
  
  // Buffers para análisis en tiempo real
  private systolicBuffer: number[] = [];
  private diastolicBuffer: number[] = [];
  private lastValidMeasurement: { systolic: number; diastolic: number } | null = null;
  
  // Rangos fisiológicos
  private readonly MIN_SYSTOLIC = 80;
  private readonly MAX_SYSTOLIC = 190;
  private readonly MIN_DIASTOLIC = 50;
  private readonly MAX_DIASTOLIC = 120;
  private readonly MIN_PULSE_PRESSURE = 25;
  private readonly MAX_PULSE_PRESSURE = 70;

  public calculateBloodPressure(values: number[]): {
    systolic: number;
    diastolic: number;
  } {
    if (!values || values.length < this.MIN_SAMPLES) {
      return this.lastValidMeasurement || { systolic: 0, diastolic: 0 };
    }

    // 1. Análisis de la forma de onda PPG
    const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
    if (peakIndices.length < 2 || valleyIndices.length < 2) {
      return this.lastValidMeasurement || { systolic: 0, diastolic: 0 };
    }

    // 2. Calcular características directas de la señal
    const waveformFeatures = this.analyzeWaveform(values, peakIndices, valleyIndices);
    
    // 3. Calcular presión basada en características de la onda
    const pressures = this.calculatePressureFromWaveform(waveformFeatures);
    
    // 4. Actualizar buffers con nuevas mediciones
    this.updateBuffers(pressures.systolic, pressures.diastolic);
    this.lastValidMeasurement = pressures;

    return pressures;
  }

  private analyzeWaveform(values: number[], peakIndices: number[], valleyIndices: number[]): {
    amplitude: number;
    peakToPeakTime: number;
    augmentationIndex: number;
    reflectionIndex: number;
    velocityRatio: number;
  } {
    // Amplitud pico a pico
    const amplitude = Math.max(...values) - Math.min(...values);

    // Tiempo entre picos (ms)
    const peakToPeakTimes = [];
    for (let i = 1; i < peakIndices.length; i++) {
      peakToPeakTimes.push((peakIndices[i] - peakIndices[i-1]) * (1000/30)); // 30Hz sampling
    }
    const peakToPeakTime = peakToPeakTimes.reduce((a,b) => a + b, 0) / peakToPeakTimes.length;

    // Índice de aumentación (relación entre onda reflejada y directa)
    const augmentationIndex = this.calculateAugmentationIndex(values, peakIndices);

    // Índice de reflexión (tiempo hasta la onda reflejada)
    const reflectionIndex = this.calculateReflectionIndex(values, peakIndices);

    // Ratio de velocidad (pendiente ascendente/descendente)
    const velocityRatio = this.calculateVelocityRatio(values, peakIndices, valleyIndices);

    return {
      amplitude,
      peakToPeakTime,
      augmentationIndex,
      reflectionIndex,
      velocityRatio
    };
  }

  private calculatePressureFromWaveform(features: {
    amplitude: number;
    peakToPeakTime: number;
    augmentationIndex: number;
    reflectionIndex: number;
    velocityRatio: number;
  }): { systolic: number; diastolic: number } {
    // 1. Estimación de presión sistólica
    let systolic = 120; // Valor base
    
    // Ajuste por tiempo entre picos (correlación inversa)
    systolic -= (features.peakToPeakTime - 800) * 0.1; // 800ms es referencia
    
    // Ajuste por amplitud (correlación directa)
    systolic += features.amplitude * 50;
    
    // Ajuste por índice de aumentación (correlación directa)
    systolic += features.augmentationIndex * 20;

    // 2. Estimación de presión diastólica
    let diastolic = 80; // Valor base
    
    // Ajuste por índice de reflexión (correlación inversa)
    diastolic -= features.reflectionIndex * 15;
    
    // Ajuste por ratio de velocidad (correlación directa)
    diastolic += features.velocityRatio * 10;

    // 3. Aplicar límites fisiológicos
    systolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, systolic));
    diastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, diastolic));

    // 4. Asegurar diferencial de presión válido
    const differential = systolic - diastolic;
    if (differential < this.MIN_PULSE_PRESSURE) {
      diastolic = systolic - this.MIN_PULSE_PRESSURE;
    } else if (differential > this.MAX_PULSE_PRESSURE) {
      diastolic = systolic - this.MAX_PULSE_PRESSURE;
    }

    return {
      systolic: Math.round(systolic),
      diastolic: Math.round(diastolic)
    };
  }

  private calculateAugmentationIndex(values: number[], peakIndices: number[]): number {
    let augmentationIndex = 0;
    
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIdx = peakIndices[i];
      const segment = values.slice(peakIdx, peakIndices[i + 1] || values.length);
      
      if (segment.length > 10) {
        const firstPeak = values[peakIdx];
        const reflectedWave = Math.max(...segment.slice(Math.floor(segment.length * 0.2)));
        augmentationIndex += (reflectedWave - firstPeak) / firstPeak;
      }
    }
    
    return augmentationIndex / peakIndices.length;
  }

  private calculateReflectionIndex(values: number[], peakIndices: number[]): number {
    let reflectionIndex = 0;
    let count = 0;
    
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIdx = peakIndices[i];
      const segment = values.slice(peakIdx, peakIndices[i + 1] || values.length);
      
      if (segment.length > 10) {
        const reflectionPoint = this.findReflectionPoint(segment);
        if (reflectionPoint > 0) {
          reflectionIndex += reflectionPoint / segment.length;
          count++;
        }
      }
    }
    
    return count > 0 ? reflectionIndex / count : 0.5;
  }

  private findReflectionPoint(segment: number[]): number {
    let maxDerivative = -Infinity;
    let reflectionPoint = -1;
    
    for (let i = Math.floor(segment.length * 0.2); i < Math.floor(segment.length * 0.8); i++) {
      const derivative = segment[i + 1] - segment[i];
      if (derivative > maxDerivative) {
        maxDerivative = derivative;
        reflectionPoint = i;
      }
    }
    
    return reflectionPoint;
  }

  private calculateVelocityRatio(values: number[], peakIndices: number[], valleyIndices: number[]): number {
    const upstrokeVelocities = [];
    const downstrokeVelocities = [];
    
    for (let i = 0; i < peakIndices.length; i++) {
      const peakIdx = peakIndices[i];
      const prevValley = valleyIndices.filter(v => v < peakIdx).pop();
      const nextValley = valleyIndices.find(v => v > peakIdx);
      
      if (prevValley !== undefined && nextValley !== undefined) {
        // Velocidad de subida
        const upstroke = (values[peakIdx] - values[prevValley]) / (peakIdx - prevValley);
        upstrokeVelocities.push(Math.abs(upstroke));
        
        // Velocidad de bajada
        const downstroke = (values[nextValley] - values[peakIdx]) / (nextValley - peakIdx);
        downstrokeVelocities.push(Math.abs(downstroke));
      }
    }
    
    const avgUpstroke = upstrokeVelocities.reduce((a,b) => a + b, 0) / upstrokeVelocities.length;
    const avgDownstroke = downstrokeVelocities.reduce((a,b) => a + b, 0) / downstrokeVelocities.length;
    
    return avgUpstroke / (avgDownstroke || 1);
  }

  private updateBuffers(systolic: number, diastolic: number): void {
    this.systolicBuffer.push(systolic);
    this.diastolicBuffer.push(diastolic);
    
    if (this.systolicBuffer.length > this.BP_BUFFER_SIZE) {
      this.systolicBuffer.shift();
      this.diastolicBuffer.shift();
    }
  }

  public reset(): void {
    this.systolicBuffer = [];
    this.diastolicBuffer = [];
    this.lastValidMeasurement = null;
  }
}
