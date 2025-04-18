/**
 * Canal especializado para la detección de Arritmias.
 * Implementa la interfaz ISignalChannel y consume datos RR.
 */
import { ISignalChannel, ChannelResult, ChannelQualityMetrics, ChannelConfig } from './ISignalChannel';
import { calculateStandardDeviation } from '../shared-signal-utils';

// Definición LOCAL TEMPORAL de RRData - Idealmente exportada desde ISignalChannel
interface RRData {
    intervals: number[];
    lastPeakTime: number | null;
}

// Definición de tipos específicos para arritmia
export type ArrhythmiaStatus = 'normal' | 'possible_arrhythmia' | 'tachycardia' | 'bradycardia' | 'irregular';

export interface ArrhythmiaResultData {
    status: ArrhythmiaStatus;
    rmssd?: number; // Root Mean Square of Successive Differences
    sdnn?: number;  // Standard Deviation of NN intervals
    pNN50?: number; // Percentage of successive intervals differing by > 50ms
    count: number; // Contador de eventos de arritmia detectados
}

export class ArrhythmiaChannel implements ISignalChannel {
    readonly id: string = 'arrhythmia';

    private config: ChannelConfig = {
        bufferSize: 50, // Número de intervalos RR a considerar
        minConfidence: 0.6, // Confianza mínima para reportar estado
        minRrIntervals: 15, // Mínimo de intervalos para análisis
        // Umbrales (ejemplos, necesitan ajuste clínico)
        rmssdThresholdLow: 15,  // Límite inferior para posible problema
        rmssdThresholdHigh: 100, // Límite superior para posible problema
        sdnnThresholdLow: 30,
        pNN50ThresholdHigh: 20, // Porcentaje alto puede indicar fibrilación auricular
        minBpmThreshold: 50, // Bradicardia
        maxBpmThreshold: 110 // Taquicardia
    };

    private rrIntervalsBuffer: number[] = []; // Almacena intervalos RR en ms
    private lastStatus: ArrhythmiaStatus = 'normal';
    private lastConfidence: number = 0;
    private arrhythmiaEventCount: number = 0;

    /**
     * Procesa los datos RR para detectar posibles arritmias.
     * @param ppgChunk No utilizado directamente, pero presente por la interfaz.
     * @param rrData Datos de intervalos RR del HeartRateChannel.
     */
    process(ppgChunk: number[], rrData?: RRData): void {
        if (!rrData || rrData.intervals.length === 0) {
            // Si no hay datos RR, no se puede procesar
            this.lastConfidence = 0;
            return;
        }

        // Usar los intervalos más recientes proporcionados por rrData
        // Podríamos concatenar o reemplazar según la estrategia deseada
        this.rrIntervalsBuffer = rrData.intervals.slice(-this.config.bufferSize);

        if (this.rrIntervalsBuffer.length < this.config.minRrIntervals) {
            this.lastConfidence = 0.1; // Confianza baja con pocos intervalos
            this.lastStatus = 'normal'; // Asumir normal con datos insuficientes
            return;
        }

        // Calcular métricas HRV (Heart Rate Variability)
        const rmssd = this.calculateRMSSD(this.rrIntervalsBuffer);
        const sdnn = calculateStandardDeviation(this.rrIntervalsBuffer);
        const pNN50 = this.calculatePNN50(this.rrIntervalsBuffer);
        const meanRR = this.rrIntervalsBuffer.reduce((a, b) => a + b, 0) / this.rrIntervalsBuffer.length;
        const bpm = meanRR > 0 ? 60000 / meanRR : 0;

        // Evaluar estado de arritmia basado en umbrales
        let currentStatus: ArrhythmiaStatus = 'normal';
        let confidenceFactor = 1.0;

        if (bpm < this.config.minBpmThreshold) {
            currentStatus = 'bradycardia';
            confidenceFactor *= 0.8;
        } else if (bpm > this.config.maxBpmThreshold) {
            currentStatus = 'tachycardia';
            confidenceFactor *= 0.8;
        } else if (rmssd < this.config.rmssdThresholdLow || rmssd > this.config.rmssdThresholdHigh) {
            currentStatus = 'possible_arrhythmia';
            confidenceFactor *= 0.7;
        } else if (sdnn < this.config.sdnnThresholdLow) {
            currentStatus = 'possible_arrhythmia';
            confidenceFactor *= 0.6;
        } else if (pNN50 > this.config.pNN50ThresholdHigh) {
            currentStatus = 'irregular'; // Podría indicar AFib
            confidenceFactor *= 0.9;
        }

        // Si se detecta una arritmia diferente a la anterior, incrementar contador
        if (currentStatus !== 'normal' && currentStatus !== this.lastStatus) {
            this.arrhythmiaEventCount++;
        }

        this.lastStatus = currentStatus;

        // Calcular confianza final basada en la cantidad y calidad de datos RR
        const intervalCountScore = Math.min(1, this.rrIntervalsBuffer.length / (this.config.minRrIntervals * 2));
        this.lastConfidence = intervalCountScore * confidenceFactor * 0.9; // Factor de ajuste final
        this.lastConfidence = Math.max(0, Math.min(1, this.lastConfidence));
    }

    /**
     * Calcula el RMSSD (Root Mean Square of Successive Differences).
     */
    private calculateRMSSD(intervals: number[]): number {
        if (intervals.length < 2) return 0;
        let sumOfSquares = 0;
        for (let i = 1; i < intervals.length; i++) {
            const diff = intervals[i] - intervals[i - 1];
            sumOfSquares += diff * diff;
        }
        return Math.sqrt(sumOfSquares / (intervals.length - 1));
    }

    /**
     * Calcula pNN50 (porcentaje de intervalos sucesivos que difieren en más de 50ms).
     */
    private calculatePNN50(intervals: number[]): number {
        if (intervals.length < 2) return 0;
        let countNN50 = 0;
        for (let i = 1; i < intervals.length; i++) {
            if (Math.abs(intervals[i] - intervals[i - 1]) > 50) {
                countNN50++;
            }
        }
        return (countNN50 / (intervals.length - 1)) * 100;
    }

    /**
     * Obtiene el último resultado de detección de Arritmia.
     * @returns Objeto con el estado de arritmia y métricas HRV, o null si no es confiable.
     */
    getResult(): ChannelResult {
        if (this.lastConfidence >= this.config.minConfidence) {
            const rmssd = this.calculateRMSSD(this.rrIntervalsBuffer);
            const sdnn = calculateStandardDeviation(this.rrIntervalsBuffer);
            const pNN50 = this.calculatePNN50(this.rrIntervalsBuffer);

            return {
                arrhythmia: {
                    status: this.lastStatus,
                    rmssd: parseFloat(rmssd.toFixed(2)),
                    sdnn: parseFloat(sdnn.toFixed(2)),
                    pNN50: parseFloat(pNN50.toFixed(2)),
                    count: this.arrhythmiaEventCount
                }
            };
        }
        return null; // No devolver estado si la confianza es baja
    }

    /**
     * Obtiene las métricas de calidad del canal de Arritmia.
     * @returns Métricas de confianza y consistencia del ritmo.
     */
    getQualityMetrics(): ChannelQualityMetrics {
         // Reutilizar métrica de consistencia basada en SDNN/RMSSD o CoV de RR
        const rrStdDev = calculateStandardDeviation(this.rrIntervalsBuffer);
        const avgIntervalMs = this.rrIntervalsBuffer.length > 0
            ? this.rrIntervalsBuffer.reduce((a, b) => a + b, 0) / this.rrIntervalsBuffer.length
            : 0;
        const rhythmConsistency = avgIntervalMs > 0 ? (1 - Math.min(1, rrStdDev / avgIntervalMs)) : 0;

        return {
            confidence: this.lastConfidence,
            rhythmConsistency: rhythmConsistency,
        };
    }

    /**
     * Actualiza la configuración del canal.
     * @param newConfig Nuevos parámetros de configuración.
     */
    updateConfig(newConfig: Partial<ChannelConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log(`ArrhythmiaChannel config updated:`, this.config);
    }

    /**
     * Obtiene la configuración actual del canal.
     * @returns Configuración actual.
     */
    getConfig(): ChannelConfig {
        return this.config;
    }

    /**
     * Resetea el estado interno del canal.
     */
    reset(): void {
        this.rrIntervalsBuffer = [];
        this.lastStatus = 'normal';
        this.lastConfidence = 0;
        this.arrhythmiaEventCount = 0;
        console.log("ArrhythmiaChannel reset.");
    }
} 