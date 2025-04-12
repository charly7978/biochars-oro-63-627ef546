import { calculateStandardDeviation, findPeaksAndValleys, calculateAmplitude, calculateDC, calculateAC } from '@/utils/signalAnalysisUtils';

export class GlucoseProcessor {
    // ... (propiedades) ...

    public calculateGlucose(ppgValues: number[]): number {
        // ... (lógica existente) ...
        const stats = this.analyzeSignal(ppgValues);
        // ... (resto de la lógica usando stats) ...
        return calculatedGlucose;
    }

    private analyzeSignal(values: number[]): {
        amplitude: number;
        frequency: number; // Nota: la implementación real de frecuencia necesitaría más contexto (ej. sampleRate)
        phase: number; // Nota: la implementación real de fase necesitaría más contexto
        perfusionIndex: number;
        areaUnderCurve: number;
        signalVariability: number;
      } {
        if (values.length < this.MIN_SAMPLES) {
          return { amplitude: 0, frequency: 0, phase: 0, perfusionIndex: 0, areaUnderCurve: 0, signalVariability: 0 };
        }

        const dc = calculateDC(values);
        const ac = calculateAC(values); // Usar AC para el índice de perfusión
        const perfusionIndex = dc > 0 ? ac / dc : 0;

        const stdDev = calculateStandardDeviation(values);
        const signalVariability = stdDev / dc; // Variabilidad relativa al DC

        const { peakIndices, valleyIndices } = findPeaksAndValleys(values);
        const amplitude = calculateAmplitude(values, peakIndices, valleyIndices);

        // Estimaciones simplificadas para frecuencia y fase (necesitarían mejoras)
        const frequency = peakIndices.length > 1 ? (peakIndices.length / (values.length / 30)) : 0; // Asumiendo 30 FPS
        const phase = 0; // Placeholder

        const areaUnderCurve = this.calculateAreaUnderCurve(values, dc); // Usar DC como baseline

        return {
          amplitude,
          frequency,
          phase,
          perfusionIndex: perfusionIndex * 100, // Escalar PI a porcentaje
          areaUnderCurve,
          signalVariability
        };
      }


     private findPeaksAndValleys(values: number[]): { peakValues: number[], valleyValues: number[] } {
         const { peakIndices, valleyIndices } = findPeaksAndValleys(values); // Usar la función consolidada
         const peakValues = peakIndices.map(idx => values[idx]);
         const valleyValues = valleyIndices.map(idx => values[idx]);
         return { peakValues, valleyValues };
     }

     private calculateAreaUnderCurve(values: number[], baseline: number): number {
        // Simple aproximación trapezoidal
        let area = 0;
        for (let i = 1; i < values.length; i++) {
            // Área de trapecio: 0.5 * (base1 + base2) * altura (altura=1 aquí)
            const base1 = Math.max(0, values[i-1] - baseline);
            const base2 = Math.max(0, values[i] - baseline);
            area += 0.5 * (base1 + base2);
        }
        return area / values.length; // Normaliza por longitud
    }

    private calculateVariability(values: number[]): number {
         const stdDev = calculateStandardDeviation(values);
         const mean = calculateDC(values);
         return mean > 0 ? stdDev / mean : 0; // Coeficiente de variación
     }

    // ... (resto de métodos como calculateConfidence, getConfidence, reset) ...
     private calculateConfidence(values: number[], perfusionIndex: number, variability: number): number {
        let confidence = 0;
        const n = values.length;

        if (n < this.MIN_SAMPLES) return 0;

        // Calidad basada en PI (más peso)
        const piQuality = Math.min(1, perfusionIndex / 5); // Asume PI > 5% es buena calidad

        // Calidad basada en baja variabilidad (inversa)
        const variabilityQuality = Math.max(0, 1 - variability * 2); // Penaliza alta variabilidad

        // Calidad basada en estabilidad temporal (si se implementa)
        // const stabilityQuality = this.calculateStability(values);

        // Combina factores de calidad (ejemplo ponderado)
        confidence = piQuality * 0.6 + variabilityQuality * 0.4;

        // Penalización si los valores están fuera de rango esperado (si se tiene min/max)
        // const rangePenalty = ...

        // Asegurar que la confianza está entre 0 y 1
        return Math.max(0, Math.min(1, confidence));
    }
     public getConfidence(): number {
        return this.confidence;
    }

     public reset(): void {
         this.previousValues = [];
         this.lastCalculatedGlucose = 0;
         this.confidence = 0;
         this.hasQualityData = false;
         console.log("GlucoseProcessor reset.");
     }


} 