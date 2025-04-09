
/**
 * Utility functions for creating and managing gradients
 */

/**
 * Creates a soft rainbow gradient with pastel colors
 * Enhanced for better PPG waveform visualization
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
  
  // Enhanced colors optimized for PPG visualization
  // Warmer colors at top for better peak visibility
  gradient.addColorStop(0, '#FEE7E7');     // Very light red at top for clear peaks
  gradient.addColorStop(0.1, '#FFDEE2');   // Soft Pastel Pink
  gradient.addColorStop(0.3, '#F2FCE2');   // Soft Mint Green
  gradient.addColorStop(0.5, '#E5DEFF');   // Soft Lavender
  gradient.addColorStop(0.7, '#D3E4FD');   // Soft Sky Blue
  gradient.addColorStop(0.85, '#B5C4E0');  // Medium Blue-Gray - improved contrast
  gradient.addColorStop(1, '#737899');     // Deeper Indigo - darker at bottom for contrast
  
  return gradient;
};

/**
 * Creates a grid pattern on the canvas with improved readability
 * Enhanced for better signal tracking and measurement
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
  ctx.globalAlpha = 0.05;  // Slightly increased for better visibility
  for (let i = 0; i < width; i += 20) {
    for (let j = 0; j < height; j += 20) {
      ctx.fillStyle = j % 40 === 0 ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.28)';
      ctx.fillRect(i, j, 10, 10);
    }
  }
  ctx.globalAlpha = 1.0;
  
  // Draw grid with improved contrast
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(60, 60, 70, 0.28)';  // Increased contrast
  ctx.lineWidth = 0.5;
  
  for (let x = 0; x <= width; x += gridSizeX) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    if (x % (gridSizeX * 5) === 0) {
      ctx.fillStyle = 'rgba(50, 50, 60, 0.75)';  // Darker text for better readability
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(x.toString(), x, height - 5);
    }
  }
  
  for (let y = 0; y <= height; y += gridSizeY) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    if (y % (gridSizeY * 5) === 0) {
      ctx.fillStyle = 'rgba(50, 50, 60, 0.75)';  // Darker text for better readability
      ctx.font = '10px Inter';
      ctx.textAlign = 'right';
      ctx.fillText(y.toString(), 15, y + 3);
    }
  }
  ctx.stroke();
  
  // Enhanced midline with physiological significance
  const midY = height / 2;
  
  // Draw primary midline
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(40, 40, 70, 0.55)';  // Increased opacity for better visibility
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.moveTo(0, midY);
  ctx.lineTo(width, midY);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw secondary lines to help visualize signal amplitude thresholds
  // These can help with identifying peak thresholds
  const thresholdLines = [0.25, 0.75]; // 25% and 75% markers
  
  thresholdLines.forEach(threshold => {
    const y = midY * threshold * 2;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(180, 40, 40, 0.2)';  // Subtle red for upper threshold
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  });
  
  ctx.setLineDash([]);
};

/**
 * Creates specialized gradient for heartbeat visualization
 * Enhanced for clearer peak visualization
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
  
  // Gradient colors optimized for PPG waveform visualization
  // More vibrant colors for better peak visibility
  gradient.addColorStop(0, 'rgba(255, 130, 120, 0.8)');    // Start with brighter red
  gradient.addColorStop(0.3, 'rgba(255, 70, 60, 0.85)');   // Transition to stronger red
  gradient.addColorStop(0.7, 'rgba(230, 40, 40, 0.9)');    // Deep red for main part
  gradient.addColorStop(1, 'rgba(190, 30, 30, 0.95)');     // End with dark red, more opaque
  
  return gradient;
};

/**
 * Draw axis labels for better data interpretation
 * Enhanced with additional physiological annotations
 * @param ctx - Canvas 2D rendering context
 * @param width - Canvas width
 * @param height - Canvas height
 */
export const drawAxisLabels = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void => {
  ctx.fillStyle = 'rgba(60, 60, 70, 0.8)';
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
  
  // Add physiological annotations
  ctx.font = '10px Inter';
  
  // Systolic area annotation
  ctx.fillStyle = 'rgba(220, 50, 50, 0.7)';
  ctx.textAlign = 'left';
  ctx.fillText('Systolic Peak', 10, height * 0.25 + 12);
  
  // Diastolic area annotation
  ctx.fillStyle = 'rgba(50, 70, 180, 0.7)';
  ctx.textAlign = 'left';
  ctx.fillText('Diastolic Phase', 10, height * 0.75 - 5);
  
  // Add central legend for scale
  ctx.fillStyle = 'rgba(60, 60, 70, 0.7)';
  ctx.textAlign = 'right';
  ctx.fillText('Scale: 5px = 33.3ms', width - 15, 15);
};

/**
 * Creates a specialized PPG waveform gradient that emphasizes cardiac features
 * @param ctx - Canvas 2D rendering context
 * @param width - Canvas width
 * @param height - Canvas height
 * @returns The created gradient object
 */
export const createPPGWaveformGradient = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): CanvasGradient => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  
  // Colors optimized for PPG waveform physiological interpretation
  // Warmer = higher blood volume/systolic, cooler = lower volume/diastolic
  gradient.addColorStop(0, 'rgba(255, 70, 70, 0.9)');     // High amplitude - systolic
  gradient.addColorStop(0.3, 'rgba(255, 120, 100, 0.8)');  // Dicrotic notch region
  gradient.addColorStop(0.5, 'rgba(230, 150, 120, 0.7)');  // Mid-range
  gradient.addColorStop(0.7, 'rgba(170, 170, 210, 0.7)');  // Lower amplitude
  gradient.addColorStop(1, 'rgba(100, 120, 180, 0.7)');    // Low amplitude - diastolic
  
  return gradient;
};

/**
 * Draw additional cardiac cycle annotations to help interpret the waveform
 * @param ctx - Canvas 2D rendering context
 * @param width - Canvas width 
 * @param height - Canvas height
 */
export const drawCardiacAnnotations = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void => {
  // Draw cardiac cycle phase indicators
  const cycleLabels = [
    { label: 'Systole', position: 0.25, color: 'rgba(255, 70, 70, 0.8)' },
    { label: 'Dicrotic Notch', position: 0.4, color: 'rgba(255, 120, 70, 0.8)' },
    { label: 'Diastole', position: 0.7, color: 'rgba(100, 120, 180, 0.8)' }
  ];
  
  ctx.font = '9px Inter';
  
  cycleLabels.forEach(item => {
    const y = height * item.position;
    
    // Draw marker line
    ctx.beginPath();
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.moveTo(width - 100, y);
    ctx.lineTo(width - 80, y);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw label
    ctx.fillStyle = item.color;
    ctx.textAlign = 'left';
    ctx.fillText(item.label, width - 75, y + 3);
  });
}
