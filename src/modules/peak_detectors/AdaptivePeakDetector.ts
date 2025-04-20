import { MovingAverage } from '../utils/MovingAverage'; // Reutilizamos la utilidad

interface PeakDetectorResult {
    isPeak: boolean;      // Si se detectó un pico en este ciclo
    timestamp: number;    // Timestamp del pico detectado (puede ser ligeramente anterior al timestamp actual)
    snr: number;          // Estimación de la relación señal/ruido en el momento
    threshold: number;    // El valor del umbral dinámico actual
}

export class AdaptivePeakDetector {
    // --- Parámetros Configurables ---

    // Factores EMA (Exponential Moving Average) para suavizar niveles (valores más bajos = más suave)
    private readonly EMA_ALPHA_SIGNAL = 0.1;   // Para actualizar el nivel de señal
    private readonly EMA_ALPHA_NOISE = 0.05;   // Para actualizar el nivel de ruido (más lento)

    // Factor para calcular el umbral: Threshold = Noise + FACTOR * (Signal - Noise)
    private readonly THRESHOLD_FACTOR = 0.35; // Ajustar entre 0.25 y 0.6 según pruebas

    // Periodo refractario: Mínimo tiempo (ms) entre picos detectados para evitar detecciones múltiples en un latido
    private readonly REFRACTORY_PERIOD_MS = 250; // Corresponde a un máximo de 240 BPM

    // Retraso de detección: Cuántos ms "hacia atrás" buscar el máximo real una vez que se cruza el umbral descendente.
    private readonly PEAK_SEARCH_BACK_MS = 120; // Buscar el máximo en los últimos ~120ms

    // Umbral mínimo absoluto para considerar un pico (evita detectar ruido muy bajo)
    private readonly MIN_ABSOLUTE_THRESHOLD = 0.05; // Ajustar según la escala de la señal filtrada

    // --- Estado Interno ---
    private signalLevel: number = 0.5;      // Estimado del nivel de amplitud de los picos
    private noiseLevel: number = 0.1;       // Estimado del nivel de ruido/línea base
    private dynamicThreshold: number = 0.2; // Umbral de detección que se ajusta
    private lastPeakTimestamp: number = 0;  // Timestamp del último pico detectado

    // Buffer para buscar el máximo local hacia atrás
    private readonly bufferDurationMs = 300; // Mantener ~300ms de historial
    private readonly maxBufferSize = 30; // 300ms @ 100Hz = 30 muestras (ajustar según tasa de muestreo)
    private signalBuffer: Float32Array = new Float32Array(this.maxBufferSize);
    private timeBuffer: Uint32Array = new Uint32Array(this.maxBufferSize);
    private bufferHead: number = 0;
    private bufferCount: number = 0;

    // Para suavizar el SNR
    private snrHistory = new MovingAverage(5);

    constructor() {
        this.reset();
    }

    public reset(): void {
        // Reiniciar a valores iniciales razonables (se adaptarán rápidamente)
        this.signalLevel = 0.5;
        this.noiseLevel = 0.1;
        this.dynamicThreshold = this.noiseLevel + this.THRESHOLD_FACTOR * (this.signalLevel - this.noiseLevel);
        this.lastPeakTimestamp = 0;
        this.signalBuffer.fill(0);
        this.timeBuffer.fill(0);
        this.bufferHead = 0;
        this.bufferCount = 0;
        this.snrHistory.clear();
        console.log("AdaptivePeakDetector: Estado reiniciado.");
    }

    /**
     * Procesa un nuevo punto de la señal FILTRADA (pasa-banda y suavizada).
     * @param value El valor actual de la señal filtrada.
     * @param timestamp El timestamp actual del punto.
     * @returns PeakDetectorResult indicando si se detectó un pico.
     */
    public process(value: number, timestamp: number): PeakDetectorResult {
        this.signalBuffer[this.bufferHead] = value;
        this.timeBuffer[this.bufferHead] = timestamp;
        this.bufferHead = (this.bufferHead + 1) % this.maxBufferSize;
        if (this.bufferCount < this.maxBufferSize) this.bufferCount++;

        let isPeakDetected = false;
        let detectedPeakTimestamp = timestamp; // Timestamp por defecto

        // --- Lógica Principal de Detección ---
        // Buscamos un cruce *descendente* del umbral dinámico, lo que indica que un pico acaba de pasar.
        const prevIdx = (this.bufferHead - 2 + this.maxBufferSize) % this.maxBufferSize;
        const previousPoint = this.bufferCount > 1 ? this.signalBuffer[prevIdx] : undefined;

        if (previousPoint !== undefined && value < this.dynamicThreshold && previousPoint >= this.dynamicThreshold) {
            // ¡Cruce descendente detectado! Ahora verificar periodo refractario.
            if (timestamp - this.lastPeakTimestamp > this.REFRACTORY_PERIOD_MS) {
                // Fuera del periodo refractario, buscar el máximo real en la ventana anterior.
                const searchStartTime = timestamp - this.PEAK_SEARCH_BACK_MS;
                const { peakValue, peakTimestamp } = this.findPeakInWindow(searchStartTime, timestamp);

                // Validar que el pico encontrado supera un mínimo absoluto
                if (peakValue > this.MIN_ABSOLUTE_THRESHOLD) {
                    isPeakDetected = true;
                    detectedPeakTimestamp = peakTimestamp;
                    this.lastPeakTimestamp = detectedPeakTimestamp; // Actualizar timestamp del último pico

                    // Actualizar Nivel de Señal (usando el valor del pico encontrado)
                    this.signalLevel = (1 - this.EMA_ALPHA_SIGNAL) * this.signalLevel + this.EMA_ALPHA_SIGNAL * peakValue;
                } else {
                     // El máximo encontrado era demasiado bajo, probablemente ruido. Actualizar nivel de ruido.
                     this.noiseLevel = (1 - this.EMA_ALPHA_NOISE) * this.noiseLevel + this.EMA_ALPHA_NOISE * peakValue;
                }

            } else {
                // Dentro del periodo refractario, ignorar este cruce (probablemente ruido o parte del mismo latido)
            }
        } else if (value < this.dynamicThreshold) {
            // Si estamos por debajo del umbral (y no justo cruzando hacia abajo), actualizar Nivel de Ruido
            this.noiseLevel = (1 - this.EMA_ALPHA_NOISE) * this.noiseLevel + this.EMA_ALPHA_NOISE * value;
        }

        // Asegurarse de que el nivel de señal sea siempre >= nivel de ruido
        if (this.signalLevel < this.noiseLevel) {
            this.signalLevel = this.noiseLevel;
        }

        // Recalcular el Umbral Dinámico para la próxima iteración
        this.dynamicThreshold = this.noiseLevel + this.THRESHOLD_FACTOR * (this.signalLevel - this.noiseLevel);
        // Aplicar umbral mínimo absoluto
        this.dynamicThreshold = Math.max(this.dynamicThreshold, this.MIN_ABSOLUTE_THRESHOLD);

        // Calcular SNR estimado y suavizarlo
        const currentSnr = this.noiseLevel > 1e-6 ? this.signalLevel / this.noiseLevel : this.signalLevel / 1e-6;
        this.snrHistory.add(currentSnr);
        const smoothedSnr = this.snrHistory.getAverage();

        return {
            isPeak: isPeakDetected,
            timestamp: detectedPeakTimestamp,
            snr: smoothedSnr,
            threshold: this.dynamicThreshold
        };
    }

    /**
     * Busca el punto con el valor máximo dentro de una ventana de tiempo en el buffer.
     * @param startTime Timestamp de inicio de la ventana de búsqueda.
     * @param endTime Timestamp de fin de la ventana de búsqueda.
     * @returns El valor máximo y su timestamp.
     */
    private findPeakInWindow(startTime: number, endTime: number): { peakValue: number; peakTimestamp: number } {
        let maxValue = -Infinity;
        let maxTimestamp = endTime; // Por defecto, el final de la ventana

        // Iterar hacia atrás en el buffer dentro del rango de tiempo
        for (let i = 0; i < this.bufferCount; i++) {
            const idx = (this.bufferHead - 1 - i + this.maxBufferSize) % this.maxBufferSize;
            const t = this.timeBuffer[idx];
            if (t < startTime) break;
            const v = this.signalBuffer[idx];
            if (t <= endTime && v > maxValue) {
                maxValue = v;
                maxTimestamp = t;
            }
        }

        // Si no se encontró ningún punto válido (raro), devolver un valor bajo
        if (maxValue === -Infinity) {
            return { peakValue: this.noiseLevel, peakTimestamp: endTime };
        }

        return { peakValue: maxValue, peakTimestamp: maxTimestamp };
    }
} 