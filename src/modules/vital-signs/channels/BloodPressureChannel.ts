/**
 * Canal especializado para la estimación de la Presión Arterial (PA).
 * Implementa la interfaz ISignalChannel.
 */
import { ISignalChannel, ChannelResult, ChannelQualityMetrics, ChannelConfig } from './ISignalChannel';
import { calculateAC, calculateDC, calculateStandardDeviation, findPeaksAndValleys } from '../shared-signal-utils';

export class BloodPressureChannel implements ISignalChannel {
    readonly id: string = 'bloodPressure';

    private config: ChannelConfig = {
        bufferSize: 150, // Tamaño del buffer para análisis PTT y características
        minConfidence: 0.45, // Confianza mínima para el resultado
        systolicCalibration: 1.0, // Factor de calibración inicial
        diastolicCalibration: 1.0, // Factor de calibración inicial
    };

    private ppgBuffer: number[] = [];
    private lastSystolic: number = 0;
    private lastDiastolic: number = 0;
    private lastConfidence: number = 0;

    // Constantes fisiológicas y de modelo (simplificadas)
    private readonly MIN_SYSTOLIC = 80;
    private readonly MAX_SYSTOLIC = 180;
    private readonly MIN_DIASTOLIC = 50;
    private readonly MAX_DIASTOLIC = 120;
    private readonly MIN_PULSE_PRESSURE = 20;
    private readonly MAX_PULSE_PRESSURE = 80;
    private readonly MIN_PEAK_COUNT = 3; // Mínimo de picos necesarios


    /**
     * Procesa el chunk de datos PPG para estimar la Presión Arterial.
     * @param ppgChunk Datos recientes de PPG.
     */
    process(ppgChunk: number[]): void {
        this.ppgBuffer = [...this.ppgBuffer, ...ppgChunk].slice(-this.config.bufferSize);

        if (this.ppgBuffer.length < this.config.bufferSize * 0.8) {
            this.lastConfidence = 0;
            return; // No hay suficientes datos
        }

        const { peakIndices, valleyIndices } = findPeaksAndValleys(this.ppgBuffer);

        if (peakIndices.length < this.MIN_PEAK_COUNT || valleyIndices.length < this.MIN_PEAK_COUNT) {
            this.lastConfidence = 0.1; // Confianza baja si no hay picos suficientes
            return;
        }

        // Calcular PTT (Pulse Transit Time) - Aproximación basada en intervalos RR
        // En un sistema real, PTT se mide entre ECG (R-peak) y PPG (peak).
        // Aquí lo aproximamos usando la variabilidad de los intervalos entre picos PPG.
        const peakTimes = peakIndices.map(idx => idx / 60 * 1000); // Asumiendo 60Hz
        const rrIntervals = [];
        for (let i = 1; i < peakTimes.length; i++) {
            rrIntervals.push(peakTimes[i] - peakTimes[i - 1]);
        }
        const avgRR = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
        const pttEstimate = avgRR * 0.3; // Factor heurístico

        // Calcular características adicionales
        const ac = calculateAC(this.ppgBuffer);
        const dc = calculateDC(this.ppgBuffer);
        const stdDev = calculateStandardDeviation(this.ppgBuffer);
        const perfusionIndex = dc > 0 ? ac / dc : 0;


        // Fórmulas simplificadas de estimación de PA basadas en PTT y otras características
        // Estas son representaciones y no modelos validados clínicamente.
        let systolic = this.MIN_SYSTOLIC + (1 / (pttEstimate + 0.01)) * 5000 + (perfusionIndex * 50) - (stdDev * 100);
        let diastolic = this.MIN_DIASTOLIC + (1 / (pttEstimate + 0.01)) * 3000 + (perfusionIndex * 30) - (stdDev * 50);

        // Aplicar calibración
        systolic *= this.config.systolicCalibration;
        diastolic *= this.config.diastolicCalibration;

        // Restringir a rangos fisiológicos y de pulso
        systolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, systolic));
        diastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, diastolic));

        const pulsePressure = systolic - diastolic;
        if (pulsePressure < this.MIN_PULSE_PRESSURE) {
            systolic = diastolic + this.MIN_PULSE_PRESSURE;
            systolic = Math.min(this.MAX_SYSTOLIC, systolic);
        } else if (pulsePressure > this.MAX_PULSE_PRESSURE) {
            systolic = diastolic + this.MAX_PULSE_PRESSURE;
             systolic = Math.min(this.MAX_SYSTOLIC, systolic);
        }
        // Asegurar que diastólica no sea mayor que sistólica después del ajuste
        diastolic = Math.min(diastolic, systolic - this.MIN_PULSE_PRESSURE);


        // Calcular confianza
        const stabilityScore = 1 - Math.min(1, stdDev / 0.1);
        const perfusionScore = Math.min(1, perfusionIndex / 0.05);
        const peakScore = Math.min(1, peakIndices.length / (this.MIN_PEAK_COUNT * 2)); // Más picos = mejor
        this.lastConfidence = (stabilityScore * 0.4 + perfusionScore * 0.4 + peakScore * 0.2);
        this.lastConfidence = Math.max(0, Math.min(1, this.lastConfidence));

        // Suavizado (EMA)
        const alpha = this.lastConfidence * 0.25;
        this.lastSystolic = this.lastSystolic > 0 ? alpha * systolic + (1 - alpha) * this.lastSystolic : systolic;
        this.lastDiastolic = this.lastDiastolic > 0 ? alpha * diastolic + (1 - alpha) * this.lastDiastolic : diastolic;

         // Restringir valores finales
        this.lastSystolic = Math.max(this.MIN_SYSTOLIC, Math.min(this.MAX_SYSTOLIC, this.lastSystolic));
        this.lastDiastolic = Math.max(this.MIN_DIASTOLIC, Math.min(this.MAX_DIASTOLIC, this.lastDiastolic));
         if (this.lastSystolic - this.lastDiastolic < this.MIN_PULSE_PRESSURE) {
             this.lastSystolic = this.lastDiastolic + this.MIN_PULSE_PRESSURE;
             this.lastSystolic = Math.min(this.MAX_SYSTOLIC, this.lastSystolic);
         }

    }

    /**
     * Obtiene el último resultado de Presión Arterial calculado.
     * @returns Objeto con sistólica y diastólica, o null si no es confiable.
     */
    getResult(): ChannelResult {
        if (this.lastConfidence >= this.config.minConfidence) {
            return {
                systolic: Math.round(this.lastSystolic),
                diastolic: Math.round(this.lastDiastolic)
            };
        }
        return null; // O devolver un valor por defecto o el último válido
    }

    /**
     * Obtiene las métricas de calidad del canal de Presión Arterial.
     * @returns Métricas de confianza y estabilidad.
     */
    getQualityMetrics(): ChannelQualityMetrics {
         const stdDev = calculateStandardDeviation(this.ppgBuffer);
         const stability = 1 - Math.min(1, stdDev / 0.1);
        return {
            confidence: this.lastConfidence,
            signalStability: stability,
        };
    }

    /**
     * Actualiza la configuración del canal.
     * @param newConfig Nuevos parámetros de configuración.
     */
    updateConfig(newConfig: Partial<ChannelConfig>): void {
        this.config = { ...this.config, ...newConfig };
         console.log(`BloodPressureChannel config updated:`, this.config);
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
        this.ppgBuffer = [];
        this.lastSystolic = 0;
        this.lastDiastolic = 0;
        this.lastConfidence = 0;
        console.log("BloodPressureChannel reset.");
    }
} 