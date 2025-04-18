/**
 * Canal especializado para la estimación de la Frecuencia Cardíaca (FC).
 * Implementa la interfaz ISignalChannel y proporciona datos RR para otros canales.
 */
import { ISignalChannel, ChannelResult, ChannelQualityMetrics, ChannelConfig, RRData } from './ISignalChannel';
import { calculateStandardDeviation, findPeaksAndValleys } from '../shared-signal-utils';

export class HeartRateChannel implements ISignalChannel {
    readonly id: string = 'heartRate';

    private config: ChannelConfig = {
        bufferSize: 300, // Suficiente para ~5 segundos a 60Hz
        minConfidence: 0.55, // Umbral de confianza para BPM
        sampleRate: 60,    // Tasa de muestreo esperada
        minBPM: 40,
        maxBPM: 200,
        minPeakDistanceMs: 300, // ~200 BPM max
        maxPeakDistanceMs: 1500, // ~40 BPM min
    };

    private ppgBuffer: number[] = [];
    private peakTimes: number[] = []; // Almacena timestamps de los picos detectados (en ms)
    private lastBPM: number = 0;
    private lastConfidence: number = 0;
    private lastRRData: RRData = { intervals: [], lastPeakTime: null };

    /**
     * Procesa el chunk de datos PPG para estimar la Frecuencia Cardíaca.
     * @param ppgChunk Datos recientes de PPG.
     */
    process(ppgChunk: number[]): void {
        this.ppgBuffer = [...this.ppgBuffer, ...ppgChunk].slice(-this.config.bufferSize);

        if (this.ppgBuffer.length < this.config.bufferSize * 0.5) {
            this.lastConfidence = 0;
            this.lastRRData = { intervals: [], lastPeakTime: null };
            return; // Datos insuficientes
        }

        const currentTimestamp = Date.now(); // Usar timestamp real

        // Detección de picos mejorada
        const { peakIndices } = findPeaksAndValleys(this.ppgBuffer);

        if (peakIndices.length < 2) {
            this.lastConfidence = 0.1; // Baja confianza sin suficientes picos
            this.lastRRData = { intervals: [], lastPeakTime: null };
            return;
        }

        // Convertir índices de pico a timestamps (estimado)
        // Asumiendo que los ppgChunk llegan a una tasa relativamente constante.
        // Una mejor aproximación requeriría timestamps por cada punto en ppgChunk.
        const estimatedSampleDurationMs = 1000 / this.config.sampleRate;
        const currentPeakTimes = peakIndices.map(idx =>
            currentTimestamp - (this.ppgBuffer.length - 1 - idx) * estimatedSampleDurationMs
        );

        // Filtrar picos demasiado juntos o demasiado separados
        const filteredPeakTimes: number[] = [];
        if (this.peakTimes.length > 0 || currentPeakTimes.length > 0) {
            let lastValidPeakTime = this.peakTimes.length > 0 ? this.peakTimes[this.peakTimes.length - 1] : currentPeakTimes[0] - (this.config.maxPeakDistanceMs + 1);

            currentPeakTimes.forEach(peakTime => {
                const interval = peakTime - lastValidPeakTime;
                if (interval >= this.config.minPeakDistanceMs && interval <= this.config.maxPeakDistanceMs) {
                    filteredPeakTimes.push(peakTime);
                    lastValidPeakTime = peakTime;
                }
            });
        }

        // Actualizar el buffer de tiempos de pico
        this.peakTimes = [...this.peakTimes, ...filteredPeakTimes].slice(-20); // Mantener últimos 20 picos

        if (this.peakTimes.length < 2) {
            this.lastConfidence = 0.15;
            this.lastRRData = { intervals: [], lastPeakTime: null };
            return;
        }

        // Calcular intervalos RR
        const rrIntervalsMs: number[] = [];
        for (let i = 1; i < this.peakTimes.length; i++) {
            rrIntervalsMs.push(this.peakTimes[i] - this.peakTimes[i - 1]);
        }

        // Calcular BPM promedio a partir de intervalos RR (más robusto)
        const avgIntervalMs = rrIntervalsMs.reduce((a, b) => a + b, 0) / rrIntervalsMs.length;
        let bpmEstimate = 0;
        if (avgIntervalMs > 0) {
            bpmEstimate = 60000 / avgIntervalMs;
        }

        // Restringir BPM a rango fisiológico
        bpmEstimate = Math.max(this.config.minBPM, Math.min(this.config.maxBPM, bpmEstimate));

        // Calcular confianza
        const stdDev = calculateStandardDeviation(this.ppgBuffer);
        const rrStdDev = calculateStandardDeviation(rrIntervalsMs);
        const stabilityScore = 1 - Math.min(1, stdDev / 0.1);
        const rhythmConsistency = 1 - Math.min(1, (rrStdDev / avgIntervalMs) || 0); // Coeficiente de variación RR
        const peakCountScore = Math.min(1, this.peakTimes.length / 10);

        this.lastConfidence = (stabilityScore * 0.3 + rhythmConsistency * 0.5 + peakCountScore * 0.2);
        this.lastConfidence = Math.max(0, Math.min(1, this.lastConfidence));

        // Suavizado EMA del BPM
        const alpha = 0.3;
        this.lastBPM = this.lastBPM > 0 ? alpha * bpmEstimate + (1 - alpha) * this.lastBPM : bpmEstimate;

        // Actualizar datos RR para otros canales
        this.lastRRData = {
            intervals: rrIntervalsMs,
            lastPeakTime: this.peakTimes.length > 0 ? this.peakTimes[this.peakTimes.length - 1] : null
        };
    }

    /**
     * Obtiene el último resultado de Frecuencia Cardíaca calculado.
     * @returns Objeto con BPM y datos RR, o null si no es confiable.
     */
    getResult(): ChannelResult {
        if (this.lastConfidence >= this.config.minConfidence) {
            return {
                bpm: Math.round(this.lastBPM),
                rrData: this.lastRRData
            };
        }
        // Devolver último válido o nulo si la confianza es baja
        // Devolvemos rrData incluso con baja confianza para que otros canales puedan usarlo
        return { rrData: this.lastRRData };
    }

    /**
     * Obtiene las métricas de calidad del canal de Frecuencia Cardíaca.
     * @returns Métricas de confianza, estabilidad y consistencia del ritmo.
     */
    getQualityMetrics(): ChannelQualityMetrics {
        const stdDev = calculateStandardDeviation(this.ppgBuffer);
        const stability = 1 - Math.min(1, stdDev / 0.1);
        const rrStdDev = calculateStandardDeviation(this.lastRRData.intervals || []);
        const avgIntervalMs = this.lastRRData.intervals.length > 0
            ? this.lastRRData.intervals.reduce((a, b) => a + b, 0) / this.lastRRData.intervals.length
            : 0;
        const rhythmConsistency = avgIntervalMs > 0 ? (1 - Math.min(1, rrStdDev / avgIntervalMs)) : 0;

        return {
            confidence: this.lastConfidence,
            signalStability: stability,
            rhythmConsistency: rhythmConsistency
        };
    }

    /**
     * Actualiza la configuración del canal.
     * @param newConfig Nuevos parámetros de configuración.
     */
    updateConfig(newConfig: Partial<ChannelConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log(`HeartRateChannel config updated:`, this.config);
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
        this.peakTimes = [];
        this.lastBPM = 0;
        this.lastConfidence = 0;
        this.lastRRData = { intervals: [], lastPeakTime: null };
        console.log("HeartRateChannel reset.");
    }
} 