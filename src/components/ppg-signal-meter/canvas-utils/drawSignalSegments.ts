
import { WINDOW_WIDTH_MS, CANVAS_CENTER_OFFSET } from '../constants';
import { getSignalColor } from '../../../utils/displayOptimizer';
import { PPGDataPoint } from '../types';

export function drawSignalSegments(
  ctx: CanvasRenderingContext2D, 
  points: PPGDataPoint[], 
  now: number,
  isPointInArrhythmiaSegment: (pointTime: number, now: number) => boolean,
  canvas: HTMLCanvasElement
) {
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
        drawSegment(ctx, segmentPoints, currentSegmentIsArrhythmia);
        segmentPoints = [];
      }
      
      currentSegmentIsArrhythmia = !!point.isArrhythmia;
    }
    
    segmentPoints.push({ x, y, isArrhythmia: !!point.isArrhythmia });
  }
  
  if (segmentPoints.length > 0) {
    drawSegment(ctx, segmentPoints, currentSegmentIsArrhythmia);
  }
}

function drawSegment(
  ctx: CanvasRenderingContext2D, 
  segmentPoints: {x: number, y: number, isArrhythmia: boolean}[],
  isArrhythmia: boolean
) {
  ctx.beginPath();
  ctx.strokeStyle = getSignalColor(isArrhythmia);
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  
  if (window.devicePixelRatio > 1) {
    ctx.shadowBlur = 0.5;
    ctx.shadowColor = getSignalColor(isArrhythmia);
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
