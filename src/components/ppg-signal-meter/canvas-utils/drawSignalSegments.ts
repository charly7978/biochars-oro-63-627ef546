
import { WINDOW_WIDTH_MS, CANVAS_CENTER_OFFSET } from '../constants';
import { getSignalColor } from '../../../utils/displayOptimizer';
import { PPGDataPoint } from '../types';

/**
 * Draws the PPG signal line on the canvas, with different colors for normal and arrhythmic segments.
 * The function splits the signal into separate segments based on arrhythmia status
 * to allow for different styling of different signal portions.
 * 
 * @param ctx - The canvas rendering context to draw on
 * @param points - Array of PPG data points to be drawn
 * @param now - Current timestamp in milliseconds
 * @param isPointInArrhythmiaSegment - Function to check if a point falls within an arrhythmia segment
 * @param canvas - The canvas element being drawn on
 */
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
    
    // Update arrhythmia status of the point
    point.isArrhythmia = point.isArrhythmia || isPointInArrhythmiaSegment(point.time, now);
    
    // Calculate position on canvas
    const x = canvas.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);
    const y = (canvas.height / 2) - CANVAS_CENTER_OFFSET - point.value;
    
    // Start a new segment if arrhythmia status changes
    if (i === 0 || currentSegmentIsArrhythmia !== !!point.isArrhythmia) {
      if (segmentPoints.length > 0) {
        drawSegment(ctx, segmentPoints, currentSegmentIsArrhythmia);
        segmentPoints = [];
      }
      
      currentSegmentIsArrhythmia = !!point.isArrhythmia;
    }
    
    segmentPoints.push({ x, y, isArrhythmia: !!point.isArrhythmia });
  }
  
  // Draw the last segment
  if (segmentPoints.length > 0) {
    drawSegment(ctx, segmentPoints, currentSegmentIsArrhythmia);
  }
}

/**
 * Helper function that draws a single segment of the PPG signal.
 * A segment is a continuous part of the signal with the same arrhythmia status.
 * 
 * @param ctx - The canvas rendering context to draw on
 * @param segmentPoints - Array of points in this segment
 * @param isArrhythmia - Whether this segment represents an arrhythmia
 */
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
  
  // Add slight shadow for high-DPI displays to improve visibility
  if (window.devicePixelRatio > 1) {
    ctx.shadowBlur = 0.5;
    ctx.shadowColor = getSignalColor(isArrhythmia);
  }
  
  // Draw the line connecting all points in the segment
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
