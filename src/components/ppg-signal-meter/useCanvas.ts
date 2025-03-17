
import { useRef, useCallback, useEffect } from 'react';
import { getSignalColor } from '../../utils/displayOptimizer';
import { PPGDataPoint } from './types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  GRID_SIZE_X, 
  GRID_SIZE_Y, 
  CANVAS_CENTER_OFFSET,
  WINDOW_WIDTH_MS, 
  ARRHYTHMIA_PULSE_COLOR, 
  ARRHYTHMIA_INDICATOR_SIZE,
  VERTICAL_SCALE
} from './constants';

export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);

  const smoothValue = useCallback((currentValue: number, previousValue: number | null): number => {
    const SMOOTHING_FACTOR = 1.6;
    if (previousValue === null) return currentValue;
    return previousValue + SMOOTHING_FACTOR * (currentValue - previousValue);
  }, []);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#E2DCFF');
    gradient.addColorStop(0.25, '#FFDECF');
    gradient.addColorStop(0.45, '#F1FBDF');
    gradient.addColorStop(0.55, '#F1EEE8');
    gradient.addColorStop(0.75, '#F5EED8');
    gradient.addColorStop(1, '#F5EED0');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.globalAlpha = 0.04;
    for (let i = 0; i < CANVAS_WIDTH; i += 20) {
      for (let j = 0; j < CANVAS_HEIGHT; j += 20) {
        const heightRatio = j / CANVAS_HEIGHT;
        const alphaModifier = 0.01 + (heightRatio * 0.03);
        
        ctx.fillStyle = j % 40 === 0 ? 
          `rgba(0,0,0,${0.2 + alphaModifier})` : 
          `rgba(255,255,255,${0.2 + alphaModifier})`;
        ctx.fillRect(i, j, 10, 10);
      }
    }
    ctx.globalAlpha = 1.0;
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(60, 60, 60, 0.22)';
    ctx.lineWidth = 0.5;
    
    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE_X) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      if (x % (GRID_SIZE_X * 5) === 0) {
        ctx.fillStyle = 'rgba(50, 50, 50, 0.6)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(x.toString(), x, CANVAS_HEIGHT - 5);
      }
    }
    
    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE_Y) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      if (y % (GRID_SIZE_Y * 5) === 0) {
        ctx.fillStyle = 'rgba(50, 50, 50, 0.6)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(y.toString(), 15, y + 3);
      }
    }
    ctx.stroke();
    
    const centerLineY = (CANVAS_HEIGHT / 2) - CANVAS_CENTER_OFFSET;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.moveTo(0, centerLineY);
    ctx.lineTo(CANVAS_WIDTH, centerLineY);
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  const drawPeaks = useCallback((
    ctx: CanvasRenderingContext2D, 
    peaks: { time: number, value: number, isArrhythmia?: boolean }[], 
    now: number,
    canvas: HTMLCanvasElement
  ) => {
    peaks.forEach(peak => {
      const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
      const y = (canvas.height / 2) - CANVAS_CENTER_OFFSET - peak.value;
      
      if (x >= 0 && x <= canvas.width) {
        const peakColor = getSignalColor(!!peak.isArrhythmia);
        
        if (peak.isArrhythmia) {
          ctx.fillStyle = ARRHYTHMIA_PULSE_COLOR;
          ctx.beginPath();
          
          const pulsePhase = (now % 1500) / 1500;
          const pulseScale = 1 + 0.15 * Math.sin(pulsePhase * Math.PI * 2);
          const pulseSize = ARRHYTHMIA_INDICATOR_SIZE * pulseScale;
          
          ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = peakColor;
          ctx.beginPath();
          ctx.arc(x, y, ARRHYTHMIA_INDICATOR_SIZE * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = peakColor;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.font = 'bold 16px Inter';
        ctx.fillStyle = peak.isArrhythmia ? '#ea384c' : '#000000';
        ctx.textAlign = 'center';
        ctx.fillText(Math.abs(peak.value / VERTICAL_SCALE).toFixed(2), x, y - 15);
      }
    });
  }, []);

  const drawSignalSegments = useCallback((
    ctx: CanvasRenderingContext2D, 
    points: PPGDataPoint[], 
    now: number,
    isPointInArrhythmiaSegment: (pointTime: number, now: number) => boolean,
    canvas: HTMLCanvasElement
  ) => {
    if (points.length <= 1) return;
    
    let segmentPoints: {x: number, y: number, isArrhythmia: boolean}[] = [];
    let currentSegmentIsArrhythmia = false;
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      point.isArrhythmia = point.isArrhythmia || isPointInArrhythmiaSegment(point.time, now);
      
      const x = canvas.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);
      const y = (canvas.height / 2) - CANVAS_CENTER_OFFSET - point.value;
      
      if (i === 0 || currentSegmentIsArrhythmia !== !!point.isArrhythmia) {
        if (segmentPoints.length > 0) {
          ctx.beginPath();
          ctx.strokeStyle = getSignalColor(currentSegmentIsArrhythmia);
          ctx.lineWidth = 2;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          
          if (window.devicePixelRatio > 1) {
            ctx.shadowBlur = 0.5;
            ctx.shadowColor = getSignalColor(currentSegmentIsArrhythmia);
          }
          
          for (let j = 0; j < segmentPoints.length; j++) {
            const segPoint = segmentPoints[j];
            if (j === 0) {
              ctx.moveTo(segPoint.x, segPoint.y);
            } else {
              ctx.lineTo(segPoint.x, segPoint.y);
            }
          }
          
          ctx.stroke();
          if (window.devicePixelRatio > 1) {
            ctx.shadowBlur = 0;
          }
          
          segmentPoints = [];
        }
        
        currentSegmentIsArrhythmia = !!point.isArrhythmia;
      }
      
      segmentPoints.push({ x, y, isArrhythmia: !!point.isArrhythmia });
    }
    
    if (segmentPoints.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = getSignalColor(currentSegmentIsArrhythmia);
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      if (window.devicePixelRatio > 1) {
        ctx.shadowBlur = 0.5;
        ctx.shadowColor = getSignalColor(currentSegmentIsArrhythmia);
      }
      
      for (let j = 0; j < segmentPoints.length; j++) {
        const segPoint = segmentPoints[j];
        if (j === 0) {
          ctx.moveTo(segPoint.x, segPoint.y);
        } else {
          ctx.lineTo(segPoint.x, segPoint.y);
        }
      }
      
      ctx.stroke();
      if (window.devicePixelRatio > 1) {
        ctx.shadowBlur = 0;
      }
    }
  }, []);

  const setupCanvases = useCallback(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_WIDTH;
    offscreen.height = CANVAS_HEIGHT;
    offscreenCanvasRef.current = offscreen;
    
    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = CANVAS_WIDTH;
    gridCanvas.height = CANVAS_HEIGHT;
    const gridCtx = gridCanvas.getContext('2d', { alpha: false });
    
    if(gridCtx) {
      drawGrid(gridCtx);
      gridCanvasRef.current = gridCanvas;
    }
  }, [drawGrid]);

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
