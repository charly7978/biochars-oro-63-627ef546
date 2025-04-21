import React, { useState, useCallback, useRef } from 'react';
import { HeartBeatProcessor } from '../modules/HeartBeatProcessor';
import { antiRedundancyGuard } from '../core/validation/CrossValidationSystem';

// Interface for heart beat analysis results
export interface HeartBeatAnalysis {
    bpm: number;
    confidence: number;
    isPeak: boolean;
    filteredValue: number;
    arrhythmiaCount: number;
}

export function useHeartBeatProcessor() {
    const processorRef = useRef<HeartBeatProcessor | null>(null);
    
    const [heartBeatAnalysis, setHeartBeatAnalysis] = useState<HeartBeatAnalysis>({
        bpm: 0,
        confidence: 0,
        isPeak: false,
        filteredValue: 0,
        arrhythmiaCount: 0
    });

    const ensureProcessor = useCallback(() => {
        if (!processorRef.current) {
            processorRef.current = new HeartBeatProcessor();
            antiRedundancyGuard.registerTask('HeartBeatProcessorHook');
        }
        return processorRef.current;
    }, []);

    const processSignal = useCallback((rawValue: number) => {
        const processor = ensureProcessor();
        
        try {
            const analysis = processor.processSignal(rawValue);
            setHeartBeatAnalysis(analysis);
            return analysis;
        } catch (error) {
            console.error('Error processing heart beat signal:', error);
            return null;
        }
    }, [ensureProcessor]);

    const reset = useCallback(() => {
        if (processorRef.current) {
            processorRef.current.reset();
            setHeartBeatAnalysis({
                bpm: 0,
                confidence: 0,
                isPeak: false,
                filteredValue: 0,
                arrhythmiaCount: 0
            });
        }
    }, []);

    React.useEffect(() => {
        return () => {
            if (processorRef.current) {
                processorRef.current.reset();
                processorRef.current = null;
            }
        };
    }, []);

    return {
        heartBeatAnalysis,
        processSignal,
        reset
    };
}
