
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { FilterOptions } from '@/types/signal';
import { SignalFilter } from './filters/SignalFilter';
import { WaveletDenoiser } from './filters/WaveletDenoiser';
import { calculateStandardDeviation } from '@/utils/vitalSignsUtils';

export interface PPGProcessedSignal {
  filteredValue: number;
  quality: number;
  isPeak: boolean;
  peakConfidence: number;
  timestamp: number;
}

export class PPGSignalProcessor {
  private readonly signalFilter: SignalFilter;
  private readonly waveletDenoiser: WaveletDenoiser;
  private readonly bufferSize: number = 200;
  private readonly qualityBufferSize: number = 10;
  
  private signalBuffer: number[] = [];
  private qualityBuffer: number[] = [];
  private lastProcessedValue: number = 0;
  private baseline: number = 0;
  private readonly BASELINE_FACTOR = 0.95;

  constructor() {
    this.signalFilter = new SignalFilter();
    this.waveletDenoiser = new WaveletDenoiser();
  }

  /**
   * Procesa una señal PPG y retorna los datos procesados
   * Solo procesa datos reales, sin simulaciones
   */
  public processSignal(value: number): PPGProcessedSignal {
    // 1. Aplicar denoising wavelet
    const denoisedValue = this.waveletDenoiser.denoise(value);
    
    // 2. Aplicar filtros en cascada
    const { filteredValue } = this.applyFilters(denoisedValue);
    
    // 3. Actualizar buffers
    this.updateBuffers(filteredValue);
    
    // 4. Calcular calidad de señal
    const quality = this.calculateSignalQuality();
    
    // 5. Detectar picos
    const { isPeak, confidence } = this.detectPeak(filteredValue);

    // 6. Actualizar valores internos
    this.lastProcessedValue = filteredValue;
    
    return {
      filteredValue,
      quality,
      isPeak,
      peakConfidence: confidence,
      timestamp: Date.now()
    };
  }

  private applyFilters(value: number): { filteredValue: number } {
    // Aplicar SMA y EMA con parámetros optimizados
    const smaFiltered = this.signalFilter.applySMAFilter(value, this.signalBuffer);
    const emaFiltered = this.signalFilter.applyEMAFilter(smaFiltered, 0.3);
    
    // Actualizar línea base
    if (this.baseline === 0) {
      this.baseline = emaFiltered;
    } else {
      this.baseline = this.BASELINE_FACTOR * this.baseline + 
                     (1 - this.BASELINE_FACTOR) * emaFiltered;
    }
    
    return { filteredValue: emaFiltered - this.baseline };
  }

  private updateBuffers(value: number): void {
    // Actualizar buffer de señal
    this.signalBuffer.push(value);
    if (this.signalBuffer.length > this.bufferSize) {
      this.signalBuffer.shift();
    }
    
    // Calcular y actualizar buffer de calidad
    const quality = this.calculateInstantQuality(value);
    this.qualityBuffer.push(quality);
    if (this.qualityBuffer.length > this.qualityBufferSize) {
      this.qualityBuffer.shift();
    }
  }

  private calculateSignalQuality(): number {
    if (this.qualityBuffer.length === 0) return 0;
    
    // Calcular promedio ponderado de calidad
    let weightedSum = 0;
    let weightSum = 0;
    
    this.qualityBuffer.forEach((q, index) => {
      const weight = index + 1;
      weightedSum += q * weight;
      weightSum += weight;
    });
    
    return weightSum > 0 ? (weightedSum / weightSum) * 100 : 0;
  }

  private calculateInstantQuality(value: number): number {
    if (this.signalBuffer.length < 3) return 0;
    
    // Calcular variación local
    const recentValues = this.signalBuffer.slice(-3);
    const stdDev = calculateStandardDeviation(recentValues);
    const signalRange = Math.max(...recentValues) - Math.min(...recentValues);
    
    // Calcular SNR aproximado
    const snr = signalRange / (stdDev || 0.001);
    
    return Math.min(Math.max(snr / 5, 0), 1); // Normalizado entre 0 y 1
  }

  private detectPeak(value: number): { isPeak: boolean; confidence: number } {
    if (this.signalBuffer.length < 3) {
      return { isPeak: false, confidence: 0 };
    }
    
    const prev1 = this.signalBuffer[this.signalBuffer.length - 1];
    const prev2 = this.signalBuffer[this.signalBuffer.length - 2];
    
    // Detectar pico basado en forma de onda
    const isPeak = value > prev1 * 1.05 && 
                  value > prev2 * 1.05 && 
                  value > 0.1;
    
    // Calcular confianza basada en amplitud y forma
    let confidence = 0;
    if (isPeak) {
      const peakAmplitude = Math.abs(value);
      confidence = Math.min(peakAmplitude / 0.5, 1);
    }
    
    return { isPeak, confidence };
  }

  public reset(): void {
    this.signalBuffer = [];
    this.qualityBuffer = [];
    this.lastProcessedValue = 0;
    this.baseline = 0;
    this.signalFilter.reset();
    this.waveletDenoiser.reset();
  }
}
