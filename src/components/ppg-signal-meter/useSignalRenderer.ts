import { useCallback, useRef, useEffect } from 'react';
import { useCanvas } from './useCanvas';
import { useSignalData } from './useSignalData';
import { useHeartbeatAudio } from './useHeartbeatAudio';
import { IMMEDIATE_RENDERING, FRAME_TIME, USE_OFFSCREEN_CANVAS, VERTICAL_SCALE } from './constants';

interface UseSignalRendererProps {
  value: number;
  isArrhythmia: boolean;
  isFingerDetected: boolean;
  preserveResults: boolean;
}

export function useSignalRenderer({ 
  value, 
  isArrhythmia, 
  isFingerDetected,
  preserveResults 
}: UseSignalRendererProps) {
  const {
    canvasRef,
    gridCanvasRef,
    offscreenCanvasRef,
    animationFrameRef,
    lastRenderTimeRef,
    drawGrid,
    drawPeaks,
    drawSignalSegments,
    smoothValue
  } = useCanvas();

  const {
    dataBufferRef,
    baselineRef,
    lastValueRef,
    peaksRef,
    initBuffer,
    clearBuffer,
    detectPeaks,
    isPointInArrhythmiaSegment,
    updateArrhythmiaState
  } = useSignalData();

  const { requestBeepForPeak } = useHeartbeatAudio();

  useEffect(() => {
    initBuffer();
  }, [initBuffer]);

  useEffect(() => {
    updateArrhythmiaState(isArrhythmia);
  }, [isArrhythmia, updateArrhythmiaState]);

  useEffect(() => {
    if (preserveResults && !isFingerDetected) {
      clearBuffer();
    }
  }, [preserveResults, isFingerDetected, clearBuffer]);

  const renderSignal = useCallback(() => {
    if (!canvasRef.current || !dataBufferRef.current) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const currentTime = performance.now();
    const timeSinceLastRender = currentTime - lastRenderTimeRef.current;
    
    if (!IMMEDIATE_RENDERING && timeSinceLastRender < FRAME_TIME) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const canvas = canvasRef.current;
    const renderCtx = USE_OFFSCREEN_CANVAS && offscreenCanvasRef.current ? 
      offscreenCanvasRef.current.getContext('2d', { alpha: false }) : 
      canvas.getContext('2d', { alpha: false });
    
    if (!renderCtx) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    const now = Date.now();
    
    if (gridCanvasRef.current) {
      renderCtx.drawImage(gridCanvasRef.current, 0, 0);
    } else {
      drawGrid(renderCtx);
    }
    
    if (preserveResults && !isFingerDetected) {
      if (USE_OFFSCREEN_CANVAS && offscreenCanvasRef.current) {
        const visibleCtx = canvas.getContext('2d', { alpha: false });
        if (visibleCtx) {
          visibleCtx.drawImage(offscreenCanvasRef.current, 0, 0);
        }
      }
      
      lastRenderTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }
    
    if (baselineRef.current === null) {
      baselineRef.current = value;
    } else {
      const adaptationRate = isFingerDetected ? 0.97 : 0.95;
      baselineRef.current = baselineRef.current * adaptationRate + value * (1 - adaptationRate);
    }
    
    const smoothedValue = smoothValue(value, lastValueRef.current);
    lastValueRef.current = smoothedValue;
    
    const normalizedValue = (baselineRef.current || 0) - smoothedValue;
    const scaledValue = normalizedValue * VERTICAL_SCALE;
    
    const pointIsArrhythmia = isArrhythmia;
    
    const dataPoint = {
      time: now,
      value: scaledValue,
      isArrhythmia: pointIsArrhythmia
    };
    
    dataBufferRef.current.push(dataPoint);
    
    const points = dataBufferRef.current.getPoints();
    detectPeaks(points, now, requestBeepForPeak);
    
    if (points.length > 1) {
      drawSignalSegments(renderCtx, points, now, isPointInArrhythmiaSegment, canvas);
      drawPeaks(renderCtx, peaksRef.current, now, canvas);
    }
    
    if (USE_OFFSCREEN_CANVAS && offscreenCanvasRef.current) {
      const visibleCtx = canvas.getContext('2d', { alpha: false });
      if (visibleCtx) {
        visibleCtx.drawImage(offscreenCanvasRef.current, 0, 0);
      }
    }
    
    lastRenderTimeRef.current = currentTime;
    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [
    canvasRef, 
    dataBufferRef, 
    value, 
    isFingerDetected, 
    isArrhythmia,
    preserveResults, 
    animationFrameRef,
    lastRenderTimeRef,
    offscreenCanvasRef,
    gridCanvasRef,
    drawGrid,
    smoothValue,
    detectPeaks,
    requestBeepForPeak,
    drawSignalSegments,
    isPointInArrhythmiaSegment,
    drawPeaks,
    peaksRef
  ]);

  useEffect(() => {
    renderSignal();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderSignal]);

  return {
    canvasRef
  };
}
