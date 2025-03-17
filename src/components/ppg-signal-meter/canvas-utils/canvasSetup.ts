
import { drawGrid } from './drawGrid';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

export function setupOffscreenCanvas(): HTMLCanvasElement {
  const offscreen = document.createElement('canvas');
  offscreen.width = CANVAS_WIDTH;
  offscreen.height = CANVAS_HEIGHT;
  return offscreen;
}

export function setupGridCanvas(drawGridFn: typeof drawGrid): HTMLCanvasElement {
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = CANVAS_WIDTH;
  gridCanvas.height = CANVAS_HEIGHT;
  const gridCtx = gridCanvas.getContext('2d', { alpha: false });
  
  if (gridCtx) {
    drawGridFn(gridCtx);
  }
  
  return gridCanvas;
}
