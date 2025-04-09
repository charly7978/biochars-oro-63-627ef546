
/**
 * Utility functions for creating and managing gradients
 */

/**
 * Creates a soft rainbow gradient with pastel colors
 * @param ctx - Canvas 2D rendering context
 * @param width - Canvas width
 * @param height - Canvas height
 * @returns The created gradient object
 */
export const createSoftRainbowGradient = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): CanvasGradient => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  
  // Soft, pastel colors at the top with increasing intensity towards bottom
  gradient.addColorStop(0, '#F2FCE2');     // Soft Mint Green - very light
  gradient.addColorStop(0.1, '#FEF7CD');   // Soft Pale Yellow
  gradient.addColorStop(0.3, '#FFDEE2');   // Soft Pastel Pink
  gradient.addColorStop(0.5, '#E5DEFF');   // Soft Lavender
  gradient.addColorStop(0.7, '#D3E4FD');   // Soft Sky Blue
  gradient.addColorStop(1, '#666592');     // Deep Indigo - darker at bottom
  
  return gradient;
};

/**
 * Creates a grid pattern on the canvas
 * @param ctx - Canvas 2D rendering context
 * @param width - Canvas width
 * @param height - Canvas height
 * @param gridSizeX - Horizontal grid size
 * @param gridSizeY - Vertical grid size
 */
export const drawCanvasGrid = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gridSizeX: number = 5,
  gridSizeY: number = 5
): void => {
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < width; i += 20) {
    for (let j = 0; j < height; j += 20) {
      ctx.fillStyle = j % 40 === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
      ctx.fillRect(i, j, 10, 10);
    }
  }
  ctx.globalAlpha = 1.0;
  
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(60, 60, 60, 0.2)';
  ctx.lineWidth = 0.5;
  
  for (let x = 0; x <= width; x += gridSizeX) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    if (x % (gridSizeX * 5) === 0) {
      ctx.fillStyle = 'rgba(50, 50, 50, 0.6)';
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(x.toString(), x, height - 5);
    }
  }
  
  for (let y = 0; y <= height; y += gridSizeY) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y); // Fixed the error here - was using undefined 'x' variable
    if (y % (gridSizeY * 5) === 0) {
      ctx.fillStyle = 'rgba(50, 50, 50, 0.6)';
      ctx.font = '10px Inter';
      ctx.textAlign = 'right';
      ctx.fillText(y.toString(), 15, y + 3);
    }
  }
  ctx.stroke();
  
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(40, 40, 40, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
  ctx.setLineDash([]);
};
