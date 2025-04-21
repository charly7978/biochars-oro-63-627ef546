// src/modules/HeartBeatProcessor.ts (Revisado)
// ¡Importante! Considerar usar una librería DSP/Numérica si es posible para filtros y FFT.
// Esta implementación usa aproximaciones y algoritmos simplificados.
import { antiRedundancyGuard } from '../core/validation/CrossValidationSystem';
import { MovingAverage } from '../utils/MovingAverage';

// Interfaz para resultados más detallados
export interface HeartBeatAnalysis {
    bpm: number;         // BPM calculado
    confidence: number;  // Confianza en la medición (0-1)
    isPeak: boolean;     // Si el último punto fue un pico detectado
    rrIntervalsMs: number[]; // Historial reciente de intervalos RR en ms
    lastRrMs: number | null; // Último intervalo RR calculado
    rmssd: number;       // RMSSD para variabilidad (indicador de arritmia/estrés)
    sdnn: number;        // SDNN para variabilidad
    isArrhythmiaLikely: boolean; // Indicador simple de posible arritmia
    filteredValue: number; // Valor de la señal después del filtrado
}

export class HeartBeatProcessor {
    // Asumir frame rate variable, usar timestamps.
    // Filtro Pasa-Banda (0.7 Hz - 2.5 Hz) -> ~42 BPM a 150 BPM
    private readonly LOW_CUTOFF_HZ = 0.7;
    private readonly HIGH_CUTOFF_HZ = 2.5;
    // Usaremos una aproximación de filtro FIR o media móvil ponderada en lugar de IIR complejo manual.
    // O idealmente, una librería FFT para análisis espectral.

    // Buffers (usar timestamps)
    private readonly SIGNAL_BUFFER_DURATION_MS = 10000; // 10 segundos
    private signalBuffer: Array<{ timestamp: number; value: number }> = [];
    private filteredBuffer: Array<{ timestamp: number; value: number }> = [];

    // Detección de Picos Adaptativa
    private peakDetector = new AdaptivePeakDetector();

    // Cálculo de BPM y RR
    private readonly RR_HISTORY_SIZE = 30; // Mantener últimos 30 intervalos RR
    private rrIntervalsMs: number[] = [];
    private lastPeakTimestamp: number | null = null;
    private bpmHistory = new MovingAverage(10); // Suavizar BPM final

    // Análisis de Variabilidad (HRV) simple
    private rmssd: number = 0;
    private sdnn: number = 0;
    private isArrhythmiaLikely: boolean = false;
    private readonly RMSSD_ARRHYTHMIA_THRESHOLD = 50; // Umbral RMSSD (ejemplo, ajustar)
    private readonly RR_DIFF_ARRHYTHMIA_THRESHOLD = 0.25; // 25% diferencia entre RR sucesivos

    // Confianza
    private confidence: number = 0;
    private readonly MIN_RR_COUNT_FOR_CONFIDENCE = 5;

    constructor() {
        this.reset();
        antiRedundancyGuard.registerFile('src/modules/HeartBeatProcessor.ts');
        antiRedundancyGuard.registerTask('HeartBeatProcessorSingleton');
    }

    public reset(): void {
        this.signalBuffer = [];
        this.filteredBuffer = [];
        this.rrIntervalsMs = [];
        this.lastPeakTimestamp = null;
        this.peakDetector.reset();
        this.bpmHistory.clear();
        this.rmssd = 0;
        this.sdnn = 0;
        this.isArrhythmiaLikely = false;
        this.confidence = 0;
        console.log("HeartBeatProcessor: Estado reiniciado.");
    }

    /**
     * Procesa un nuevo valor de señal PPG (idealmente del canal verde).
     * Asume que el valor es la señal cruda o pre-procesada (ej. promedio móvil).
     */
    public processSignal(rawValue: number, timestamp: number): HeartBeatAnalysis {
        // 1. Actualizar Buffer de Señal Cruda
        this.signalBuffer.push({ timestamp, value: rawValue });
        // Mantener buffer dentro de la duración definida
        while (this.signalBuffer.length > 0 && timestamp - this.signalBuffer[0].timestamp > this.SIGNAL_BUFFER_DURATION_MS) {
            this.signalBuffer.shift();
        }

        // Necesitamos suficientes datos para procesar
        if (this.signalBuffer.length < 10) { // Mínimo ~300ms a 30fps
            return this.createDefaultResult(rawValue);
        }

        // 2. Filtrado Pasa-Banda (Simplificado: Detrend + Suavizado)
        // Idealmente: usar un filtro Butterworth/FIR bien diseñado o FFT.
        // Simplificación: quitar línea base (detrend) y suavizar.
        const detrendedSignal = this.detrendSignal(this.signalBuffer);
        const smoothedSignal = this.smoothSignal(detrendedSignal); // Podría ser una media móvil ponderada
        this.filteredBuffer = smoothedSignal; // Guardar para posible visualización/análisis

        if (this.filteredBuffer.length === 0) {
             return this.createDefaultResult(rawValue);
        }

        const currentFilteredPoint = this.filteredBuffer[this.filteredBuffer.length - 1];
        const currentFilteredValue = currentFilteredPoint.value;

        // 3. Detección de Picos Adaptativa
        const peakResult = this.peakDetector.process(currentFilteredPoint.value, currentFilteredPoint.timestamp);
        const isPeak = peakResult.isPeak;

        let lastRrMs: number | null = null;

        // 4. Cálculo de Intervalos RR
        if (isPeak) {
            const currentPeakTime = peakResult.timestamp; // Usar timestamp del detector
            if (this.lastPeakTimestamp !== null) {
                const rr = currentPeakTime - this.lastPeakTimestamp;
                // Validar RR fisiológicamente (ej. 300ms a 1800ms -> ~33 a 200 BPM)
                if (rr >= 300 && rr <= 1800) {
                    this.rrIntervalsMs.push(rr);
                    lastRrMs = rr;
                    if (this.rrIntervalsMs.length > this.RR_HISTORY_SIZE) {
                        this.rrIntervalsMs.shift();
                    }
                    // Analizar posible arritmia con el nuevo RR
                    this.analyzeArrhythmia(rr);
                } else {
                     console.warn(`RR Intervalo descartado: ${rr} ms`);
                }
            }
            this.lastPeakTimestamp = currentPeakTime;
        }

        // 5. Cálculo de BPM Robusto (usando promedio recortado de RR)
        const bpm = this.calculateRobustBPM();
        this.bpmHistory.add(bpm); // Suavizar BPM resultante

        // 6. Cálculo de Confianza
        this.confidence = this.calculateConfidence(peakResult.snr);

        // 7. Cálculo de HRV (RMSSD, SDNN)
        this.calculateHRV();


        return {
            bpm: this.bpmHistory.size() > 0 ? Math.round(this.bpmHistory.getAverage()) : 0,
            confidence: this.confidence,
            isPeak: isPeak,
            rrIntervalsMs: [...this.rrIntervalsMs],
            lastRrMs: lastRrMs,
            rmssd: this.rmssd,
            sdnn: this.sdnn,
            isArrhythmiaLikely: this.isArrhythmiaLikely,
            filteredValue: currentFilteredValue
        };
    }

    private createDefaultResult(rawValue: number) : HeartBeatAnalysis {
         return {
            bpm: 0, confidence: 0, isPeak: false, rrIntervalsMs: [], lastRrMs: null,
            rmssd: 0, sdnn: 0, isArrhythmiaLikely: false, filteredValue: rawValue
         };
    }

    // --- Funciones Auxiliares ---

    private detrendSignal(signal: Array<{ timestamp: number; value: number }>): Array<{ timestamp: number; value: number }> {
        // Simplificado: Restar una media móvil lenta (ej. 1-2 segundos)
        const slowWindowSize = Math.min(signal.length, Math.round(1.5 / this.getAverageFrameInterval(signal))); // Ventana de ~1.5s
         if (slowWindowSize < 3) return signal; // No detrend si la ventana es muy pequeña

        const movingAvg = new MovingAverage(slowWindowSize);
        const detrended: Array<{ timestamp: number; value: number }> = [];
        for (const point of signal) {
             movingAvg.add(point.value);
             if (movingAvg.size() >= slowWindowSize / 2) { // Empezar a detrend cuando el promedio esté algo estable
                 detrended.push({ timestamp: point.timestamp, value: point.value - movingAvg.getAverage() });
             } else if (detrended.length > 0) {
                 // Usar el último valor detrended si el promedio aún no está listo
                 detrended.push({ timestamp: point.timestamp, value: detrended[detrended.length-1].value });
             } else {
                 detrended.push({ timestamp: point.timestamp, value: 0 }); // Valor inicial
             }
        }
        return detrended;
    }

     private smoothSignal(signal: Array<{ timestamp: number; value: number }>): Array<{ timestamp: number; value: number }> {
        // Simplificado: Media móvil rápida (ej. 3-5 puntos)
        const fastWindowSize = 5;
        const movingAvg = new MovingAverage(fastWindowSize);
        const smoothed: Array<{ timestamp: number; value: number }> = [];
         for (const point of signal) {
             movingAvg.add(point.value);
             smoothed.push({ timestamp: point.timestamp, value: movingAvg.getAverage() });
         }
        return smoothed;
    }

    private getAverageFrameInterval(signal: Array<{ timestamp: number; value: number }>): number {
        if (signal.length < 2) return 33; // Asumir ~30 fps por defecto
        const intervals = [];
        for (let i = 1; i < signal.length; i++) {
            intervals.push(signal[i].timestamp - signal[i - 1].timestamp);
        }
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        return avg > 0 ? avg : 33; // Evitar división por cero
    }


    private calculateRobustBPM(): number {
        if (this.rrIntervalsMs.length < 3) { // Necesitar al menos 3 intervalos para robustez
            return 0;
        }

        // Convertir RR a BPM instantáneos
        const bpmValues = this.rrIntervalsMs.map(rr => 60000 / rr);

        // Usar mediana o promedio recortado
        const sortedBpm = [...bpmValues].sort((a, b) => a - b);
        const trimCount = Math.floor(sortedBpm.length * 0.15); // Recortar 15% de cada extremo
        const trimmedBpm = sortedBpm.slice(trimCount, sortedBpm.length - trimCount);

        if (trimmedBpm.length === 0) {
            // Si todo fue recortado, usar la mediana original
             const mid = Math.floor(sortedBpm.length / 2);
             return sortedBpm.length % 2 !== 0 ? sortedBpm[mid] : (sortedBpm[mid - 1] + sortedBpm[mid]) / 2;
        }

        const avgBpm = trimmedBpm.reduce((a, b) => a + b, 0) / trimmedBpm.length;

        // Validar rango fisiológico
        if (avgBpm < 35 || avgBpm > 210) {
            return 0; // BPM fuera de rango probable
        }

        return avgBpm;
    }

     private calculateConfidence(snr: number): number {
         // Basar confianza en:
         // 1. Número de RR intervalos válidos recientes
         // 2. Estabilidad de los RR intervalos (bajo SDNN/RMSSD relativo)
         // 3. Relación señal/ruido (SNR) del detector de picos

         const rrCountFactor = Math.min(1.0, this.rrIntervalsMs.length / this.MIN_RR_COUNT_FOR_CONFIDENCE);

         // Usar Coeficiente de Variación de RR (SDNN / Mean RR) como medida de inestabilidad
         const meanRR = this.rrIntervalsMs.length > 0
             ? this.rrIntervalsMs.reduce((a, b) => a + b, 0) / this.rrIntervalsMs.length
             : 0;
         const rrCoV = meanRR > 0 ? (this.sdnn / meanRR) : 1.0; // CoV alto -> baja confianza
         const stabilityFactor = Math.max(0, 1.0 - rrCoV * 2); // Penalizar CoV > 0.5

         // Usar SNR del detector de picos (asumiendo snr está en un rango razonable, ej 0-20)
         const snrFactor = Math.min(1.0, snr / 10.0); // Normalizar SNR (ej. SNR=10 -> factor=1)

         // Combinar factores (ajustar pesos según importancia)
         const confidence = rrCountFactor * (0.4 * stabilityFactor + 0.6 * snrFactor);

         // Suavizar confianza
         const alpha = 0.1;
         this.confidence = this.confidence * (1 - alpha) + confidence * alpha;

         return Math.max(0, Math.min(1, this.confidence));
     }

    private calculateHRV(): void {
        if (this.rrIntervalsMs.length < 5) { // Necesitar suficientes intervalos para HRV
            this.rmssd = 0;
            this.sdnn = 0;
            return;
        }

        const rr = this.rrIntervalsMs;
        const n = rr.length;

        // RMSSD: Raíz cuadrada de la media de las diferencias al cuadrado entre RR sucesivos
        let sumSqDiff = 0;
        for (let i = 0; i < n - 1; i++) {
            sumSqDiff += Math.pow(rr[i + 1] - rr[i], 2);
        }
        this.rmssd = Math.sqrt(sumSqDiff / (n - 1));

        // SDNN: Desviación estándar de todos los intervalos RR
        const meanRR = rr.reduce((a, b) => a + b, 0) / n;
        const sumSqDev = rr.map(val => Math.pow(val - meanRR, 2)).reduce((a, b) => a + b, 0);
        this.sdnn = Math.sqrt(sumSqDev / n);
    }

    private analyzeArrhythmia(lastRR: number): void {
         if (this.rrIntervalsMs.length < 3) {
             this.isArrhythmiaLikely = false;
             return;
         }

         // Criterio 1: RMSSD elevado (variabilidad a corto plazo alta)
         const isRmssdHigh = this.rmssd > this.RMSSD_ARRHYTHMIA_THRESHOLD;

         // Criterio 2: Gran diferencia porcentual entre último RR y el anterior
         const prevRR = this.rrIntervalsMs[this.rrIntervalsMs.length - 2];
         const rrDiffRatio = Math.abs(lastRR - prevRR) / prevRR;
         const isRrDiffHigh = rrDiffRatio > this.RR_DIFF_ARRHYTHMIA_THRESHOLD;

         // Combinar criterios (ej. si cualquiera es verdadero)
         this.isArrhythmiaLikely = isRmssdHigh || isRrDiffHigh;

         // Podría añadirse lógica más compleja (ej. patrones específicos, ectópicos)
    }
}


// --- Clase Auxiliar: Detector de Picos Adaptativo (Simplificado) ---
class AdaptivePeakDetector {
    private readonly MIN_PEAK_HEIGHT_FACTOR = 0.5; // Pico debe ser al menos 50% del umbral dinámico
    private readonly LOOKBACK_WINDOW_MS = 500; // Ventana para calcular umbrales
    private readonly REFRACTORY_PERIOD_MS = 250; // Mínimo tiempo entre picos

    private signalBuffer: Array<{ timestamp: number; value: number }> = [];
    private noiseLevel: number = 0.1; // Estimación inicial ruido
    private signalLevel: number = 1.0; // Estimación inicial señal
    private dynamicThreshold: number = 0.5; // Umbral adaptativo
    private lastPeakTimestamp: number = 0;
    private potentialPeak: { timestamp: number; value: number } | null = null;

    reset() {
        this.signalBuffer = [];
        this.noiseLevel = 0.1;
        this.signalLevel = 1.0;
        this.dynamicThreshold = 0.5;
        this.lastPeakTimestamp = 0;
        this.potentialPeak = null;
    }

    process(value: number, timestamp: number): { isPeak: boolean; timestamp: number, snr: number } {
        this.updateBuffer(value, timestamp);

        let isPeak = false;
        let peakTimestamp = timestamp;
        let snr = this.signalLevel / (this.noiseLevel + 1e-6); // SNR estimado

        // Buscar máximo local en una pequeña ventana reciente
        const lookbackIndex = this.findBufferIndex(timestamp - 150); // Buscar en últimos ~150ms
        if (lookbackIndex === -1 || this.signalBuffer.length < 3) {
             return { isPeak: false, timestamp, snr };
        }

        const recentWindow = this.signalBuffer.slice(lookbackIndex);
        const currentIndex = recentWindow.length - 1;

        // Asegurarse de que hay suficientes puntos antes y después si es posible
         if (currentIndex < 1 || recentWindow.length < 3) {
             return { isPeak: false, timestamp, snr };
         }

        const currentPoint = recentWindow[currentIndex];
        const prevPoint = recentWindow[currentIndex - 1];
        //const prev2Point = recentWindow[currentIndex - 2]; // Podríamos requerir más historia

        // Lógica de detección de pico (ejemplo: máximo local + umbral + refractario)
        // 1. ¿Es un máximo local reciente? (Simplificado: ¿es mayor que el anterior?)
        // Una mejor aproximación buscaría el máximo en una ventana deslizante.
        // Aquí simplificamos: si el valor *anterior* fue un máximo local potencial.
        if (prevPoint.value > currentPoint.value && // Valor empieza a bajar
            prevPoint.value > this.dynamicThreshold && // Supera umbral
            prevPoint.timestamp - this.lastPeakTimestamp > this.REFRACTORY_PERIOD_MS // Fuera de periodo refractario
            )
        {
             // Pico detectado en el punto *anterior*
             isPeak = true;
             peakTimestamp = prevPoint.timestamp;
             this.lastPeakTimestamp = peakTimestamp;

             // Actualizar niveles de señal y umbral basado en el pico detectado
             this.signalLevel = 0.125 * prevPoint.value + 0.875 * this.signalLevel; // EMA señal
             this.dynamicThreshold = this.noiseLevel + 0.25 * (this.signalLevel - this.noiseLevel); // Umbral entre ruido y señal

             // Resetear pico potencial
             this.potentialPeak = null;

        } else if (value < this.dynamicThreshold) {
             // Si el valor cae por debajo del umbral, actualizar nivel de ruido
             this.noiseLevel = 0.125 * value + 0.875 * this.noiseLevel; // EMA ruido
             this.dynamicThreshold = this.noiseLevel + 0.25 * (this.signalLevel - this.noiseLevel);
        }

         // Asegurar que el umbral no sea negativo
         this.dynamicThreshold = Math.max(0.05, this.dynamicThreshold); // Umbral mínimo

        return { isPeak, timestamp: peakTimestamp, snr };
    }

    private updateBuffer(value: number, timestamp: number) {
         this.signalBuffer.push({ timestamp, value });
         // Mantener buffer dentro de la ventana de tiempo
         while (this.signalBuffer.length > 0 && timestamp - this.signalBuffer[0].timestamp > this.LOOKBACK_WINDOW_MS * 1.5) { // Mantener un poco más que la ventana
             this.signalBuffer.shift();
         }
    }

     private findBufferIndex(targetTimestamp: number): number {
        // Búsqueda simple (podría optimizarse con búsqueda binaria si el buffer es grande)
        for (let i = this.signalBuffer.length - 1; i >= 0; i--) {
            if (this.signalBuffer[i].timestamp <= targetTimestamp) {
                return i;
            }
        }
        return -1; // No encontrado (o targetTimestamp es anterior al inicio del buffer)
    }
}