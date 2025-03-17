
import { useRef, useCallback, useEffect } from 'react';
import { drawGrid } from './canvas-utils/drawGrid';
import { drawPeaks } from './canvas-utils/drawPeaks';
import { drawSignalSegments } from './canvas-utils/drawSignalSegments';
import { smoothValue } from './canvas-utils/valueSmoothing';
import { setupOffscreenCanvas, setupGridCanvas } from './canvas-utils/canvasSetup';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';

export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);

  const setupCanvases = useCallback(() => {
    offscreenCanvasRef.current = setupOffscreenCanvas();
    gridCanvasRef.current = setupGridCanvas(drawGrid);
  }, []);

  useEffect(() => {
    setupCanvases();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [setupCanvases]);

  return {
    canvasRef,
    gridCanvasRef,
    offscreenCanvasRef,
    animationFrameRef,
    lastRenderTimeRef,
    drawGrid,
    drawPeaks,
    drawSignalSegments,
    smoothValue
  };
}
