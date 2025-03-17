
import { ARRHYTHMIA_PULSE_COLOR, ARRHYTHMIA_INDICATOR_SIZE, WINDOW_WIDTH_MS, VERTICAL_SCALE } from '../constants';
import { getSignalColor } from '../../../utils/displayOptimizer';
import { Peak } from '../types';

/**
 * Draws peak markers on the PPG signal display.
 * Peaks represent detected heart beats and can be normal or arrhythmic.
 * Different visualizations are used for normal vs. arrhythmic peaks.
 * 
 * @param ctx - The canvas rendering context to draw on
 * @param peaks - Array of peak data points to be drawn
 * @param now - Current timestamp in milliseconds
 * @param canvas - The canvas element being drawn on
 */
export function drawPeaks(
  ctx: CanvasRenderingContext2D, 
  peaks: Peak[], 
  now: number,
  canvas: HTMLCanvasElement
) {
  peaks.forEach(peak => {
    // Calculate peak position on canvas
    const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
    const y = (canvas.height / 2) - 60 - peak.value;
    
    if (x >= 0 && x <= canvas.width) {
      const peakColor = getSignalColor(!!peak.isArrhythmia);
      
      // Draw arrhythmia peaks with a pulsing indicator for emphasis
      if (peak.isArrhythmia) {
        ctx.fillStyle = ARRHYTHMIA_PULSE_COLOR;
        ctx.beginPath();
        
        // Create pulsing effect for arrhythmia indicators
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
        // Draw normal peaks as simple circles
        ctx.fillStyle = peakColor;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Draw peak value label
      ctx.font = 'bold 16px Inter';
      ctx.fillStyle = peak.isArrhythmia ? '#ea384c' : '#000000';
      ctx.textAlign = 'center';
      ctx.fillText(Math.abs(peak.value / VERTICAL_SCALE).toFixed(2), x, y - 15);
    }
  });
}
