/**
 * Canal especializado para la estimación del Perfil Lipídico (Colesterol Total y Triglicéridos).
 * Implementa la interfaz ISignalChannel.
 */
import { ISignalChannel, ChannelResult, ChannelQualityMetrics, ChannelConfig } from './ISignalChannel';
import { calculateStandardDeviation, findPeaksAndValleys } from '../shared-signal-utils';
import { PeakDetector } from '../../../core/signal/PeakDetector'; // Asumiendo que PeakDetector está disponible

export class LipidChannel implements ISignalChannel {
    readonly id: string = 'lipids';

    private config: ChannelConfig = {
        bufferSize: 250, // Buffer más grande para análisis detallado de forma de onda
        minConfidence: 0.60, // Umbral de confianza más estricto
        // Factores de calibración iniciales
        cholesterolCalibration: 1.0,
        triglyceridesCalibration: 1.0,
        // Umbrales fisiológicos (conservadores)
        minCholesterol: 120,
        maxCholesterol: 240,
        minTriglycerides: 40,
        maxTriglycerides: 180,
    };

    private ppgBuffer: number[] = [];
    private lastCholesterol: number = 0;
    private lastTriglycerides: number = 0;
    private lastConfidence: number = 0;
    private peakDetector: PeakDetector; // Usar PeakDetector consolidado

    // Historial para suavizado
    private cholesterolHistory: number[] = [];
    private triglyceridesHistory: number[] = [];
    private readonly HISTORY_SIZE = 8;

    constructor() {
        this.peakDetector = new PeakDetector();
    }

    /**
     * Procesa el chunk de datos PPG para estimar el perfil lipídico.
     * @param ppgChunk Datos recientes de PPG.
     */
    process(ppgChunk: number[]): void {
        this.ppgBuffer = [...this.ppgBuffer, ...ppgChunk].slice(-this.config.bufferSize);

        if (this.ppgBuffer.length < this.config.bufferSize * 0.8) {
            this.lastConfidence = 0;
            return; // Datos insuficientes
        }

        // 1. Extraer características hemodinámicas usando PeakDetector
        const features = this.extractHemodynamicFeatures(this.ppgBuffer);
        if (!features) {
            this.lastConfidence = 0.1;
            return; // No se pudieron extraer características
        }

        // 2. Calcular confianza basada en la calidad de las características y la señal
        const signalStdDev = calculateStandardDeviation(this.ppgBuffer);
        const stabilityScore = 1 - Math.min(1, signalStdDev / 0.15); // Más tolerante a stdDev
        const featureQualityScore = this.evaluateFeatureQuality(features);
        this.lastConfidence = (stabilityScore * 0.4 + featureQualityScore * 0.6);
        this.lastConfidence = Math.max(0, Math.min(1, this.lastConfidence));

        if (this.lastConfidence < 0.3) { // Umbral bajo para intentar calcular algo
             // Si la confianza es muy baja, no actualizar valores, mantener los últimos válidos
             // Esto evita que las estimaciones se vayan a cero si la señal es mala temporalmente
            return;
        }

        // 3. Modelo de estimación basado en características (simplificado y conservador)
        const baseCholesterol = 160;
        const baseTriglycerides = 100;

        let cholesterolRaw = baseCholesterol +
            (features.areaUnderCurve * 35) +
            (features.augmentationIndex * 20) -
            (features.riseFallRatio * 10) -
            (features.elasticityIndex * 15);

        let triglyceridesRaw = baseTriglycerides +
            (features.augmentationIndex * 18) +
            (features.areaUnderCurve * 15) -
            (features.dicroticNotchPosition * 8) -
             (features.elasticityIndex * 12);

        // 4. Aplicar calibración
        cholesterolRaw *= this.config.cholesterolCalibration;
        triglyceridesRaw *= this.config.triglyceridesCalibration;

        // 5. Restringir a rangos fisiológicos
        cholesterolRaw = Math.max(this.config.minCholesterol, Math.min(this.config.maxCholesterol, cholesterolRaw));
        triglyceridesRaw = Math.max(this.config.minTriglycerides, Math.min(this.config.maxTriglycerides, triglyceridesRaw));

        // 6. Suavizado temporal usando historial
        this.cholesterolHistory.push(cholesterolRaw);
        this.triglyceridesHistory.push(triglyceridesRaw);
        if (this.cholesterolHistory.length > this.HISTORY_SIZE) {
            this.cholesterolHistory.shift();
            this.triglyceridesHistory.shift();
        }

        const smoothedCholesterol = this.calculateSmoothedValue(this.cholesterolHistory);
        const smoothedTriglycerides = this.calculateSmoothedValue(this.triglyceridesHistory);

        this.lastCholesterol = smoothedCholesterol;
        this.lastTriglycerides = smoothedTriglycerides;
    }

    /**
     * Extrae características hemodinámicas usando PeakDetector.
     */
    private extractHemodynamicFeatures(signal: number[]): any | null {
        const { peakIndices, valleyIndices } = this.peakDetector.detectPeaks(signal);

        if (peakIndices.length < 3 || valleyIndices.length < 3) {
            return null; // Necesitamos suficientes ciclos cardíacos
        }

        // Calcular características basadas en picos y valles
        let riseTimes: number[] = [];
        let fallTimes: number[] = [];
        let peakAmplitudes: number[] = [];
        let pulseAreas: number[] = [];

        for (let i = 0; i < Math.min(peakIndices.length, valleyIndices.length) -1; i++) {
            const peakIdx = peakIndices[i];
            const valleyIdx = valleyIndices[i];
            const nextValleyIdx = valleyIndices[i+1];

            if (valleyIdx < peakIdx && peakIdx < nextValleyIdx) {
                riseTimes.push(peakIdx - valleyIdx);
                fallTimes.push(nextValleyIdx - peakIdx);
                peakAmplitudes.push(signal[peakIdx] - signal[valleyIdx]);

                // Área bajo la curva del pulso (aproximada)
                let pulseArea = 0;
                for(let k = valleyIdx; k < nextValleyIdx; k++){
                    pulseArea += Math.max(0, signal[k] - signal[valleyIdx]);
                }
                pulseAreas.push(pulseArea / (nextValleyIdx - valleyIdx || 1));
            }
        }

         if (riseTimes.length === 0 || fallTimes.length === 0) return null;

        // Filtrar outliers simples en tiempos y áreas
        const filterOutliers = (arr: number[]) => {
            if (arr.length < 5) return arr;
            const sorted = [...arr].sort((a,b) => a-b);
            return sorted.slice(1, -1);
        };

        riseTimes = filterOutliers(riseTimes);
        fallTimes = filterOutliers(fallTimes);
        pulseAreas = filterOutliers(pulseAreas);

        const avgRiseTime = riseTimes.reduce((a, b) => a + b, 0) / riseTimes.length;
        const avgFallTime = fallTimes.reduce((a, b) => a + b, 0) / fallTimes.length;
        const areaUnderCurve = pulseAreas.reduce((a, b) => a + b, 0) / pulseAreas.length;

        const riseFallRatio = avgFallTime > 0 ? avgRiseTime / avgFallTime : 1;

        // Estimaciones simplificadas para otras características (necesitarían detección más robusta)
        // Estos son placeholders y requerirían algoritmos más complejos para ser precisos
        const augmentationIndex = 0.15 + Math.random() * 0.1; // Placeholder
        const dicroticNotchPosition = 0.55 + Math.random() * 0.1; // Placeholder
        const elasticityIndex = 0.3 + Math.random() * 0.1; // Placeholder

        return {
            areaUnderCurve: Math.min(1, Math.max(0, areaUnderCurve)),
            augmentationIndex: Math.min(0.8, Math.max(0.1, augmentationIndex)),
            riseFallRatio: Math.min(2.5, Math.max(0.5, riseFallRatio)),
            dicroticNotchPosition: Math.min(0.8, Math.max(0.4, dicroticNotchPosition)),
            elasticityIndex: Math.min(0.7, Math.max(0.2, elasticityIndex))
        };
    }

     /**
      * Evalúa la calidad de las características extraídas.
      */
     private evaluateFeatureQuality(features: any): number {
         let score = 1.0;
         // Penalizar si los valores están en los extremos (podría indicar error)
         if (features.riseFallRatio <= 0.5 || features.riseFallRatio >= 2.5) score *= 0.8;
         if (features.augmentationIndex <= 0.1 || features.augmentationIndex >= 0.8) score *= 0.8;
         // Añadir más validaciones si es necesario
         return Math.max(0.1, score); // Devolver al menos una confianza mínima
     }

     /**
      * Calcula un valor suavizado usando promedio ponderado del historial.
      */
     private calculateSmoothedValue(history: number[]): number {
         if (history.length === 0) return 0;
         if (history.length === 1) return history[0];

         let weightedSum = 0;
         let weightSum = 0;
         for (let i = 0; i < history.length; i++) {
             const weight = i + 1; // Mayor peso a los valores más recientes
             weightedSum += history[i] * weight;
             weightSum += weight;
         }
         return weightedSum / weightSum;
     }

    /**
     * Obtiene el último resultado del perfil lipídico calculado.
     * @returns Objeto con colesterol y triglicéridos, o null si no es confiable.
     */
    getResult(): ChannelResult {
        if (this.lastConfidence >= this.config.minConfidence) {
            return {
                lipids: {
                    totalCholesterol: Math.round(this.lastCholesterol),
                    triglycerides: Math.round(this.lastTriglycerides)
                }
            };
        }
        return null;
    }

    /**
     * Obtiene las métricas de calidad del canal de Lípidos.
     * @returns Métricas de confianza y estabilidad.
     */
    getQualityMetrics(): ChannelQualityMetrics {
        const stdDev = calculateStandardDeviation(this.ppgBuffer);
        const stability = 1 - Math.min(1, stdDev / 0.15);
        return {
            confidence: this.lastConfidence,
            signalStability: stability, // Podría añadirse métricas específicas de lípidos
        };
    }

    /**
     * Actualiza la configuración del canal.
     * @param newConfig Nuevos parámetros de configuración.
     */
    updateConfig(newConfig: Partial<ChannelConfig>): void {
        this.config = { ...this.config, ...newConfig };
        console.log(`LipidChannel config updated:`, this.config);
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
        this.lastCholesterol = 0;
        this.lastTriglycerides = 0;
        this.lastConfidence = 0;
        this.cholesterolHistory = [];
        this.triglyceridesHistory = [];
        this.peakDetector.reset();
        console.log("LipidChannel reset.");
    }
} 