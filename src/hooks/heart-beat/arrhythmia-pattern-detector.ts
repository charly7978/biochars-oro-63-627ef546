import { useRef, useState, useEffect, useCallback } from 'react';

interface Beat {
  timestamp: number;
  rr: number;
  isAnomalous: boolean;
}

interface ArrhythmiaPatternDetectorState {
  phase: 'learning' | 'monitoring';
  baseRR: number;
  baseSDNN: number;
  beats: Beat[];
  lastBeatTime: number | null;
}

const LEARNING_DURATION_MS = 6000;
const ANOMALY_THRESHOLD = 0.20; // ±20%
const MIN_BEATS_FOR_BASE = 5;

export function useArrhythmiaPatternDetector() {
  const [state, setState] = useState<ArrhythmiaPatternDetectorState>({
    phase: 'learning',
    baseRR: 0,
    baseSDNN: 0,
    beats: [],
    lastBeatTime: null
  });
  const learningStartRef = useRef<number | null>(null);

  // Llamar esto cada vez que se detecta un latido (pico)
  const registerBeat = useCallback(() => {
    const now = Date.now();
    let rr = 0;
    if (state.lastBeatTime) {
      rr = now - state.lastBeatTime;
    }
    let newBeats = [...state.beats];
    if (state.lastBeatTime) {
      newBeats.push({ timestamp: now, rr, isAnomalous: false });
    }
    // Fase de aprendizaje
    if (state.phase === 'learning') {
      if (!learningStartRef.current) learningStartRef.current = now;
      // Solo guardar los primeros latidos
      if (newBeats.length >= MIN_BEATS_FOR_BASE) {
        // Calcular baseRR y baseSDNN
        const rrVals = newBeats.map(b => b.rr);
        const baseRR = rrVals.reduce((a, b) => a + b, 0) / rrVals.length;
        const mean = baseRR;
        const sdnn = Math.sqrt(rrVals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / rrVals.length);
        // Si pasaron 6 segundos, pasar a fase de monitoreo
        if (now - (learningStartRef.current || now) >= LEARNING_DURATION_MS) {
          setState({
            phase: 'monitoring',
            baseRR,
            baseSDNN: sdnn,
            beats: newBeats,
            lastBeatTime: now
          });
          return;
        }
        setState(s => ({ ...s, beats: newBeats, lastBeatTime: now, baseRR, baseSDNN: sdnn }));
      } else {
        setState(s => ({ ...s, beats: newBeats, lastBeatTime: now }));
      }
    } else {
      // Fase de monitoreo: comparar cada nuevo RR con el patrón base
      let isAnomalous = false;
      if (state.baseRR > 0 && rr > 0) {
        const deviation = Math.abs(rr - state.baseRR) / state.baseRR;
        isAnomalous = deviation > ANOMALY_THRESHOLD;
      }
      newBeats.push({ timestamp: now, rr, isAnomalous });
      // Mantener solo los últimos 20 latidos
      if (newBeats.length > 20) newBeats = newBeats.slice(-20);
      setState(s => ({ ...s, beats: newBeats, lastBeatTime: now }));
    }
  }, [state]);

  // Resetear detector
  const reset = useCallback(() => {
    learningStartRef.current = null;
    setState({
      phase: 'learning',
      baseRR: 0,
      baseSDNN: 0,
      beats: [],
      lastBeatTime: null
    });
  }, []);

  return {
    phase: state.phase,
    baseRR: state.baseRR,
    baseSDNN: state.baseSDNN,
    beats: state.beats,
    registerBeat,
    reset
  };
} 