/**
 * Canal especializado para el procesamiento de SpO2 (Saturación de Oxígeno).
 * Implementa la interfaz ISignalChannel.
 */
import { ISignalChannel, ChannelResult, ChannelQualityMetrics, ChannelConfig } from './ISignalChannel';
import { calculateAC, calculateDC, calculateStandardDeviation, normalizeValues } from '../shared-signal-utils';

export class SpO2Channel implements ISignalChannel {
    readonly id: string = 'spo2';

    private config: ChannelConfig = {
        bufferSize: 120, // Tamaño del buffer interno para cálculo
        ratioCalibration: 1.0, // Factor de calibración inicial para el ratio
        minConfidence: 0.4, // Confianza mínima para considerar válido el resultado
    };

    private ppgBuffer: number[] = [];
    private lastSpO2: number = 0;
    private lastConfidence: number = 0;

    /**
     * Procesa el chunk de datos PPG para calcular SpO2.
     * @param ppgChunk Datos recientes de PPG.
     */
    process(ppgChunk: number[]): void {
        // Mantener el buffer interno actualizado con los datos más recientes
        this.ppgBuffer = [...this.ppgBuffer, ...ppgChunk].slice(-this.config.bufferSize);

        if (this.ppgBuffer.length < this.config.bufferSize / 2) {
            this.lastConfidence = 0;
            this.lastSpO2 = 0; // No hay suficientes datos
            return;
        }

        // Calcular componentes AC y DC
        const ac = calculateAC(this.ppgBuffer);
        const dc = calculateDC(this.ppgBuffer);

        if (dc === 0 || ac < 0.01) { // Evitar división por cero y señal muy débil
            this.lastConfidence = 0.1; // Confianza baja si la señal es débil
            this.lastSpO2 = this.lastSpO2 > 0 ? this.lastSpO2 : 95; // Mantener último valor o default
            return;
        }

        // Calcular Ratio of Ratios (R) - Simplificado para monocanal
        // En un sistema real, necesitaríamos señales Roja e Infrarroja.
        // Aquí simulamos una dependencia basada en la variabilidad y la perfusión.
        const stdDev = calculateStandardDeviation(this.ppgBuffer);
        const perfusionIndex = ac / dc;

        // Estimación de R basada en características de la señal única (aproximación)
        // Mayor variabilidad o menor perfusión pueden indicar menor SpO2 (correlación inversa)
        const estimatedR = 0.6 + (stdDev * 5) + (1 / (perfusionIndex * 10 + 1));

        // Fórmula de calibración empírica para SpO2 (ejemplo)
        // SpO2 = A - B * R
        // Los coeficientes A y B dependen de la calibración del sensor específico.
        // Usaremos valores genéricos aquí.
        const A = 110;
        const B = 25;
        let calculatedSpo2 = A - B * estimatedR * this.config.ratioCalibration;

        // Limitar a rango fisiológico (80% - 100%)
        calculatedSpo2 = Math.max(80, Math.min(100, calculatedSpo2));

        // Calcular confianza basada en estabilidad y perfusión
        const stabilityScore = 1 - Math.min(1, stdDev / 0.1); // Menor desviación = mayor estabilidad
        const perfusionScore = Math.min(1, perfusionIndex / 0.05); // Mayor perfusión = mejor señal
        this.lastConfidence = (stabilityScore * 0.6 + perfusionScore * 0.4);
        this.lastConfidence = Math.max(0, Math.min(1, this.lastConfidence)); // Asegurar rango 0-1

        // Suavizar el resultado con el valor anterior basado en la confianza
        if (this.lastSpO2 > 0) {
             const alpha = this.lastConfidence * 0.3; // Más peso al nuevo valor si la confianza es alta
             this.lastSpO2 = alpha * calculatedSpo2 + (1 - alpha) * this.lastSpO2;
        } else {
            this.lastSpO2 = calculatedSpo2;
        }

        // Asegurar que el resultado final esté dentro de los límites
        this.lastSpO2 = Math.max(80, Math.min(100, this.lastSpO2));

    }

    /**
     * Obtiene el último valor de SpO2 calculado.
     * @returns El valor de SpO2 o 0 si no es confiable.
     */
    getResult(): ChannelResult {
        // Solo devolver resultado si la confianza supera el umbral
        return this.lastConfidence >= this.config.minConfidence ? Math.round(this.lastSpO2) : 0;
    }

    /**
     * Obtiene las métricas de calidad del canal SpO2.
     * @returns Métricas de confianza y estabilidad.
     */
    getQualityMetrics(): ChannelQualityMetrics {
         const stdDev = calculateStandardDeviation(this.ppgBuffer);
         const stability = 1 - Math.min(1, stdDev / 0.1);
        return {
            confidence: this.lastConfidence,
            signalStability: stability,
            // Podrían añadirse otras métricas como SNR si se calculan
        };
    }

    /**
     * Actualiza la configuración del canal.
     * @param newConfig Nuevos parámetros de configuración.
     */
    updateConfig(newConfig: Partial<ChannelConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log(`SpO2Channel config updated:`, this.config);
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
        this.lastSpO2 = 0;
        this.lastConfidence = 0;
        console.log("SpO2Channel reset.");
    }
} 