import { findPeaksAndValleys, calculateStandardDeviation, calculateDC } from '@/utils/signalAnalysisUtils';

export class LipidProcessor {
    public calculateLipids(ppgValues: number[]): {
        totalCholesterol: number;
        triglycerides: number;
    } {
        const features = this.extractHemodynamicFeatures(ppgValues);
        this.confidenceScore = this.calculateConfidence(features, ppgValues);
        return { totalCholesterol: finalCholesterol, triglycerides: finalTriglycerides };
    }

    private extractHemodynamicFeatures(ppgValues: number[]): {
        areaUnderCurve: number;
        augmentationIndex: number;
        riseFallRatio: number;
        dicroticNotchPosition: number;
        dicroticNotchHeight: number;
        elasticityIndex: number;
    } {
        if (ppgValues.length < 50) {
            return { areaUnderCurve: 0, augmentationIndex: 0, riseFallRatio: 0, dicroticNotchPosition: 0, dicroticNotchHeight: 0, elasticityIndex: 0 };
        }

        const { peaks, troughs } = this.findPeaksAndTroughs(ppgValues);
        if (peaks.length < 2 || troughs.length < 1) {
            return { areaUnderCurve: 0, augmentationIndex: 0, riseFallRatio: 0, dicroticNotchPosition: 0, dicroticNotchHeight: 0, elasticityIndex: 0 };
        }

        const dcValue = calculateDC(ppgValues);
        const areaUnderCurve = ppgValues.reduce((sum, val) => sum + Math.max(0, val - dcValue), 0) / ppgValues.length;

        const augmentationIndex = 0.5;
        const riseFallRatio = 1.0;
        const dicroticNotchPosition = 0.6;
        const dicroticNotchHeight = 0.7;
        const elasticityIndex = 0.8;

        return {
            areaUnderCurve,
            augmentationIndex,
            riseFallRatio,
            dicroticNotchPosition,
            dicroticNotchHeight,
            elasticityIndex,
        };
    }

    private findPeaksAndTroughs(signal: number[]): { peaks: number[], troughs: number[] } {
        const { peakIndices, valleyIndices } = findPeaksAndValleys(signal);
        const peaks = peakIndices.map(i => signal[i]);
        const troughs = valleyIndices.map(i => signal[i]);
        return { peaks, troughs };
    }

    private findDicroticNotches(signal: number[], peaks: number[], troughs: number[]): number[] {
        const notches: number[] = [];
        return notches;
    }

    private calculateConfidence(features: any, signal: number[]): number {
        let score = 0;
        const MIN_AREA = 0.01;

        if (features.areaUnderCurve > MIN_AREA) score += 0.3;

        const stdDev = calculateStandardDeviation(signal);
        const dc = calculateDC(signal);
        const snrEstimate = dc / stdDev;
        if (snrEstimate > 5) score += 0.4;

        return Math.min(1, Math.max(0, score));
    }

    public reset(): void {
        this.cholesterolHistory = [];
        this.triglyceridesHistory = [];
        this.lastCholesterolEstimate = 170;
        this.lastTriglyceridesEstimate = 100;
        this.confidenceScore = 0;
        console.log("LipidProcessor reset.");
    }

    public getConfidence(): number {
        return this.confidenceScore;
    }
} 