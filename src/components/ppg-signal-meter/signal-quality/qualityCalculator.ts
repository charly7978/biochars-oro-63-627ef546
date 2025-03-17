
/**
 * Quality calculation utilities for signal processing
 */
import { 
  MIN_AMPLITUDE_THRESHOLD,
  MAX_NOISE_RATIO,
  MIN_DERIVATIVE_THRESHOLD
} from './constants';
import { calculateNoiseLevel } from './noiseAnalyzer';

export function calculateAverageQuality(
  qualityHistory: number[],
  signalAmplitudeHistory: number[],
  noiseBuffer: number[],
  derivativeBuffer: number[]
): number {
  if (qualityHistory.length === 0) return 0;
  
  // Calculate weighted quality score
  let weightedSum = 0;
  let weightSum = 0;
  
  qualityHistory.forEach((q, index) => {
    const weight = Math.pow(1.3, index);
    weightedSum += q * weight;
    weightSum += weight;
  });
  
  let avgQuality = weightSum > 0 ? weightedSum / weightSum : 0;
  
  // Apply amplitude factor
  if (signalAmplitudeHistory.length > 10) {
    const avgAmplitude = signalAmplitudeHistory.reduce((sum, amp) => sum + amp, 0) / 
                        signalAmplitudeHistory.length;
    
    if (avgAmplitude < MIN_AMPLITUDE_THRESHOLD) {
      avgQuality = Math.max(0, avgQuality * 0.4);
    }
  }
  
  // Apply noise factor
  if (noiseBuffer.length > 10) {
    const noiseLevel = calculateNoiseLevel(noiseBuffer);
    if (noiseLevel > MAX_NOISE_RATIO) {
      avgQuality = Math.max(0, avgQuality * 0.5);
    }
  }
  
  // Apply derivative factor
  if (derivativeBuffer.length > 10) {
    const avgDerivative = derivativeBuffer.reduce((sum, d) => sum + d, 0) / 
                         derivativeBuffer.length;
    
    if (avgDerivative < MIN_DERIVATIVE_THRESHOLD) {
      avgQuality = Math.max(0, avgQuality * 0.6);
    }
  }
  
  return avgQuality;
}

export function getQualityColor(quality: number, isFingerDetected: boolean): string {
  if (!isFingerDetected) return 'from-gray-400 to-gray-500';
  if (quality > 70) return 'from-green-500 to-emerald-500';
  if (quality > 45) return 'from-yellow-500 to-orange-500';
  return 'from-red-500 to-rose-500';
}

export function getQualityText(quality: number, isFingerDetected: boolean): string {
  if (!isFingerDetected) return 'Sin detección';
  if (quality > 70) return 'Señal óptima';
  if (quality > 45) return 'Señal aceptable';
  return 'Señal débil';
}
