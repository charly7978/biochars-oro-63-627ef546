
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
  
  // Enhanced colors for better visualization of PPG signals
  gradient.addColorStop(0, '#F2FCE2');     // Soft Mint Green - very light
  gradient.addColorStop(0.1, '#FEF7CD');   // Soft Pale Yellow
  gradient.addColorStop(0.3, '#FFDEE2');   // Soft Pastel Pink
  gradient.addColorStop(0.5, '#E5DEFF');   // Soft Lavender
  gradient.addColorStop(0.7, '#D3E4FD');   // Soft Sky Blue
  gradient.addColorStop(0.85, '#A9B9DE');  // Medium Periwinkle - helps track the signal
  gradient.addColorStop(1, '#666592');     // Deep Indigo - darker at bottom
  
  return gradient;
};

/**
 * Creates a grid pattern on the canvas with improved readability
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
  // Improved contrast for better signal visualization
  ctx.globalAlpha = 0.04;  // Slightly increased for better visibility
  for (let i = 0; i < width; i += 20) {
    for (let j = 0; j < height; j += 20) {
      ctx.fillStyle = j % 40 === 0 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)';
      ctx.fillRect(i, j, 10, 10);
    }
  }
  ctx.globalAlpha = 1.0;
  
  // Draw grid with improved contrast
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(60, 60, 60, 0.25)';  // Increased contrast
  ctx.lineWidth = 0.5;
  
  for (let x = 0; x <= width; x += gridSizeX) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    if (x % (gridSizeX * 5) === 0) {
      ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';  // Darker text for better readability
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(x.toString(), x, height - 5);
    }
  }
  
  for (let y = 0; y <= height; y += gridSizeY) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    if (y % (gridSizeY * 5) === 0) {
      ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';  // Darker text for better readability
      ctx.font = '10px Inter';
      ctx.textAlign = 'right';
      ctx.fillText(y.toString(), 15, y + 3);
    }
  }
  ctx.stroke();
  
  // Enhanced midline for better reference
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(40, 40, 40, 0.5)';  // Increased opacity for better visibility
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
  ctx.setLineDash([]);
};

/**
 * Creates specialized gradient for heartbeat visualization
 * @param ctx - Canvas 2D rendering context
 * @param width - Canvas width
 * @param height - Canvas height
 * @returns The created gradient object
 */
export const createHeartbeatGradient = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): CanvasGradient => {
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  
  // Gradient colors optimized for PPG signal visualization
  gradient.addColorStop(0, 'rgba(255, 120, 120, 0.8)');    // Start with soft red
  gradient.addColorStop(0.3, 'rgba(255, 60, 60, 0.8)');    // Transition to stronger red
  gradient.addColorStop(0.7, 'rgba(220, 40, 40, 0.8)');    // Deep red
  gradient.addColorStop(1, 'rgba(180, 30, 30, 0.8)');      // End with dark red
  
  return gradient;
};

/**
 * Draw axis labels for better data interpretation
 * @param ctx - Canvas 2D rendering context
 * @param width - Canvas width
 * @param height - Canvas height
 */
export const drawAxisLabels = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void => {
  ctx.fillStyle = 'rgba(60, 60, 60, 0.8)';
  ctx.font = '12px Inter';
  
  // X-axis (time)
  ctx.textAlign = 'center';
  ctx.fillText('Time (ms)', width / 2, height - 5);
  
  // Y-axis (amplitude)
  ctx.save();
  ctx.translate(15, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Amplitude', 0, 0);
  ctx.restore();
};
