/**
 * Canal especializado para la estimación de Glucosa en sangre.
 * Implementa la interfaz ISignalChannel.
 */
import { ISignalChannel, ChannelResult, ChannelQualityMetrics, ChannelConfig } from './ISignalChannel';
import { calculateStandardDeviation, findPeaksAndValleys, calculateAC, calculateDC } from '../shared-signal-utils';

export class GlucoseChannel implements ISignalChannel {
    readonly id: string = 'glucose';

    private config: ChannelConfig = {
        bufferSize: 200, // Tamaño de buffer para análisis de características
        minConfidence: 0.5, // Umbral de confianza
        glucoseBaseline: 90, // Valor base de referencia (puede ser calibrado)
        calibrationFactor: 1.0 // Factor de calibración inicial
    };

    private ppgBuffer: number[] = [];
    private lastGlucose: number = 0;
    private lastConfidence: number = 0;
    private previousValues: number[] = []; // Para suavizado
    private readonly STABILITY_WINDOW = 5;

    // Factores de ponderación para características (simplificado)
    private readonly PERFUSION_FACTOR = 0.4;
    private readonly AMPLITUDE_FACTOR = 0.1;
    private readonly VARIABILITY_FACTOR = 0.15;
    private readonly AREA_UNDER_CURVE_FACTOR = 0.1;

    /**
     * Procesa el chunk de datos PPG para estimar la Glucosa.
     * @param ppgChunk Datos recientes de PPG.
     */
    process(ppgChunk: number[]): void {
        this.ppgBuffer = [...this.ppgBuffer, ...ppgChunk].slice(-this.config.bufferSize);

        if (this.ppgBuffer.length < this.config.bufferSize * 0.7) {
            this.lastConfidence = 0;
            return; // Datos insuficientes
        }

        const stdDev = calculateStandardDeviation(this.ppgBuffer);
        const ac = calculateAC(this.ppgBuffer);
        const dc = calculateDC(this.ppgBuffer);

        if (ac < 0.04 || stdDev > 0.2) { // Comprobación básica de calidad
            this.lastConfidence = 0.1; // Baja confianza si la señal es ruidosa o plana
            return;
        }

        const { peakIndices, valleyIndices } = findPeaksAndValleys(this.ppgBuffer);
        if (peakIndices.length < 2 || valleyIndices.length < 2) {
             this.lastConfidence = 0.15; // Baja confianza si no hay picos/valles claros
             return;
        }

        // Calcular características relevantes
        const perfusionIndex = dc > 0 ? ac / dc : 0;
        const amplitude = this.calculateAmplitude(peakIndices, valleyIndices); // Usar una versión robusta
        const variability = stdDev / (dc || 1); // Variabilidad relativa
        const areaUnderCurve = this.calculateAreaUnderCurve(this.ppgBuffer, dc);

        // Modelo de estimación simplificado
        let glucoseEstimate = this.config.glucoseBaseline;
        glucoseEstimate += (perfusionIndex - 0.05) * this.PERFUSION_FACTOR * 50;
        glucoseEstimate += (amplitude - 0.1) * this.AMPLITUDE_FACTOR * 60;
        glucoseEstimate += (variability - 0.1) * this.VARIABILITY_FACTOR * -40; // Variabilidad alta puede indicar menor glucosa
        glucoseEstimate += (areaUnderCurve - 0.05) * this.AREA_UNDER_CURVE_FACTOR * 30;

        // Aplicar calibración
        glucoseEstimate *= this.config.calibrationFactor;

        // Restringir a rango fisiológico (ej. 70-180 mg/dL)
        glucoseEstimate = Math.max(70, Math.min(180, glucoseEstimate));

        // Calcular confianza
        const stabilityScore = 1 - Math.min(1, stdDev / 0.1);
        const perfusionScore = Math.min(1, perfusionIndex / 0.08);
        const amplitudeScore = Math.min(1, amplitude / 0.15);
        this.lastConfidence = (stabilityScore * 0.4 + perfusionScore * 0.3 + amplitudeScore * 0.3);
        this.lastConfidence = Math.max(0, Math.min(1, this.lastConfidence));

        // Suavizar lectura
        this.previousValues.push(glucoseEstimate);
        if (this.previousValues.length > this.STABILITY_WINDOW) {
            this.previousValues.shift();
        }
        const smoothedGlucose = this.previousValues.reduce((a, b) => a + b, 0) / this.previousValues.length;

        this.lastGlucose = smoothedGlucose;
    }

     /**
     * Calcula la amplitud promedio entre picos y valles.
     */
    private calculateAmplitude(peakIndices: number[], valleyIndices: number[]): number {
        if (peakIndices.length === 0 || valleyIndices.length === 0) return 0;
        const amps: number[] = [];
        const len = Math.min(peakIndices.length, valleyIndices.length);
        for (let i = 0; i < len; i++) {
            amps.push(this.ppgBuffer[peakIndices[i]] - this.ppgBuffer[valleyIndices[i]]);
        }
         // Media robusta (eliminar 10% extremos)
        amps.sort((a, b) => a - b);
        const trimmedAmps = amps.slice(Math.floor(amps.length * 0.1), Math.ceil(amps.length * 0.9));
        return trimmedAmps.length > 0
            ? trimmedAmps.reduce((a, b) => a + b, 0) / trimmedAmps.length
            : 0;
    }

    /**
     * Calcula el área bajo la curva relativa a la línea base (DC).
     */
    private calculateAreaUnderCurve(values: number[], baseline: number): number {
        let area = 0;
        for (const value of values) {
            area += Math.max(0, value - baseline); // Solo área sobre la línea base
        }
        return area / values.length;
    }


    /**
     * Obtiene el último resultado de Glucosa calculado.
     * @returns Objeto con el valor de glucosa, o null si no es confiable.
     */
    getResult(): ChannelResult {
        if (this.lastConfidence >= this.config.minConfidence) {
            return {
                glucose: Math.round(this.lastGlucose)
            };
        }
        return null;
    }

    /**
     * Obtiene las métricas de calidad del canal de Glucosa.
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
         console.log(`GlucoseChannel config updated:`, this.config);
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
        this.lastGlucose = 0;
        this.lastConfidence = 0;
        this.previousValues = [];
         console.log("GlucoseChannel reset.");
    }
} 