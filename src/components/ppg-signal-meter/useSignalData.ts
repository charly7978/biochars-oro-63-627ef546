
import { useRef, useCallback } from 'react';
import { CircularBuffer } from '../../utils/CircularBuffer';
import { PPGDataPoint, Peak, ArrhythmiaSegment, ArrhythmiaTransition } from './types';
import { 
  BUFFER_SIZE, 
  PEAK_DETECTION_WINDOW, 
  PEAK_THRESHOLD, 
  MIN_PEAK_DISTANCE_MS, 
  MAX_PEAKS_TO_DISPLAY, 
  WINDOW_WIDTH_MS 
} from './constants';

export function useSignalData() {
  const dataBufferRef = useRef<CircularBuffer<PPGDataPoint> | null>(null);
  const baselineRef = useRef<number | null>(null);
  const lastValueRef = useRef<number | null>(null);
  const peaksRef = useRef<Peak[]>([]);
  const lastBeepRequestTimeRef = useRef<number>(0);
  const arrhythmiaTransitionRef = useRef<ArrhythmiaTransition>({ 
    active: false, 
    startTime: 0, 
    endTime: null 
  });
  const arrhythmiaSegmentsRef = useRef<ArrhythmiaSegment[]>([]);
  const lastArrhythmiaTimeRef = useRef<number>(0);

  const initBuffer = useCallback(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer<PPGDataPoint>(BUFFER_SIZE);
    }
  }, []);

  const clearBuffer = useCallback(() => {
    if (dataBufferRef.current) {
      dataBufferRef.current.clear();
    }
    peaksRef.current = [];
    baselineRef.current = null;
    lastValueRef.current = null;
  }, []);

  const detectPeaks = useCallback((points: PPGDataPoint[], now: number, requestBeepForPeak: (time: number) => void) => {
    if (points.length < PEAK_DETECTION_WINDOW) return;
    
    const potentialPeaks: {index: number, value: number, time: number, isArrhythmia?: boolean}[] = [];
    
    for (let i = PEAK_DETECTION_WINDOW; i < points.length - PEAK_DETECTION_WINDOW; i++) {
      const currentPoint = points[i];
      
      const recentlyProcessed = peaksRef.current.some(
        peak => Math.abs(peak.time - currentPoint.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (recentlyProcessed) continue;
      
      let isPeak = true;
      
      for (let j = i - PEAK_DETECTION_WINDOW; j < i; j++) {
        if (points[j].value >= currentPoint.value) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        for (let j = i + 1; j <= i + PEAK_DETECTION_WINDOW; j++) {
          if (j < points.length && points[j].value > currentPoint.value) {
            isPeak = false;
            break;
          }
        }
      }
      
      if (isPeak && Math.abs(currentPoint.value) > PEAK_THRESHOLD) {
        const isInArrhythmiaSegment = arrhythmiaSegmentsRef.current.some(segment => {
          const endTime = segment.endTime || now;
          return currentPoint.time >= segment.startTime && currentPoint.time <= endTime;
        });
        
        potentialPeaks.push({
          index: i,
          value: currentPoint.value,
          time: currentPoint.time,
          isArrhythmia: isInArrhythmiaSegment
        });
      }
    }
    
    for (const peak of potentialPeaks) {
      const tooClose = peaksRef.current.some(
        existingPeak => Math.abs(existingPeak.time - peak.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (!tooClose) {
        peaksRef.current.push({
          time: peak.time,
          value: peak.value,
          isArrhythmia: peak.isArrhythmia
        });
        
        requestBeepForPeak(peak.time);
      }
    }
    
    peaksRef.current.sort((a, b) => a.time - b.time);
    
    peaksRef.current = peaksRef.current
      .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
      .slice(-MAX_PEAKS_TO_DISPLAY);
  }, []);

  const isPointInArrhythmiaSegment = useCallback((pointTime: number, now: number): boolean => {
    const isNearArrhythmicPeak = peaksRef.current.some(peak => 
      peak.isArrhythmia && Math.abs(pointTime - peak.time) < 300
    );
    
    if (isNearArrhythmicPeak) return true;
    
    return arrhythmiaSegmentsRef.current.some(segment => {
      const endTime = segment.endTime || now;
      const segmentAge = now - endTime;
      return segmentAge < 3000 && pointTime >= segment.startTime && pointTime <= endTime;
    });
  }, []);

  const updateArrhythmiaState = useCallback((isArrhythmia: boolean) => {
    const now = Date.now();
    
    if (isArrhythmia && !arrhythmiaTransitionRef.current.active) {
      arrhythmiaTransitionRef.current = { 
        active: true, 
        startTime: now, 
        endTime: null 
      };
      
      arrhythmiaSegmentsRef.current.push({
        startTime: now,
        endTime: null
      });
      
      lastArrhythmiaTimeRef.current = now;
      
      console.log('PPGSignalMeter: Arrhythmia detected at', new Date(now).toISOString());
    } 
    else if (!isArrhythmia && arrhythmiaTransitionRef.current.active) {
      arrhythmiaTransitionRef.current = {
        ...arrhythmiaTransitionRef.current,
        active: false,
        endTime: now
      };
      
      if (arrhythmiaSegmentsRef.current.length > 0) {
        const lastIndex = arrhythmiaSegmentsRef.current.length - 1;
        if (arrhythmiaSegmentsRef.current[lastIndex].endTime === null) {
          arrhythmiaSegmentsRef.current[lastIndex].endTime = now;
        }
      }
      
      console.log('PPGSignalMeter: End of arrhythmia at', new Date(now).toISOString());
    }
    
    arrhythmiaSegmentsRef.current = arrhythmiaSegmentsRef.current.filter(
      segment => now - (segment.endTime || now) < 3000
    );
  }, []);

  const resetArrhythmiaData = useCallback(() => {
    arrhythmiaTransitionRef.current = { active: false, startTime: 0, endTime: null };
    arrhythmiaSegmentsRef.current = [];
    lastArrhythmiaTimeRef.current = 0;
  }, []);

  return {
    dataBufferRef,
    baselineRef,
    lastValueRef,
    peaksRef,
    lastBeepRequestTimeRef,
    arrhythmiaTransitionRef,
    arrhythmiaSegmentsRef,
    initBuffer,
    clearBuffer,
    detectPeaks,
    isPointInArrhythmiaSegment,
    updateArrhythmiaState,
    resetArrhythmiaData
  };
}
