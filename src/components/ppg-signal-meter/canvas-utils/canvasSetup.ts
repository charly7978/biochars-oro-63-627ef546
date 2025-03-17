
import { drawGrid } from './drawGrid';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

/**
 * Creates and initializes an offscreen canvas for improved rendering performance.
 * Offscreen canvases are used to prepare complex renderings before displaying them
 * on the visible canvas, reducing visual artifacts.
 * 
 * @returns A newly created offscreen canvas element with the appropriate dimensions
 */
export function setupOffscreenCanvas(): HTMLCanvasElement {
  const offscreen = document.createElement('canvas');
  offscreen.width = CANVAS_WIDTH;
  offscreen.height = CANVAS_HEIGHT;
  return offscreen;
}

/**
 * Creates and initializes a canvas specifically for the grid background.
 * Since the grid rarely changes, drawing it once and reusing it improves performance.
 * 
 * @param drawGridFn - The function used to draw the grid on the canvas
 * @returns A canvas element with the grid pattern drawn on it
 */
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
