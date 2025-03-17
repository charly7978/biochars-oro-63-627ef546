
import { ARRHYTHMIA_PULSE_COLOR, ARRHYTHMIA_INDICATOR_SIZE, WINDOW_WIDTH_MS, VERTICAL_SCALE } from '../constants';
import { getSignalColor } from '../../../utils/displayOptimizer';
import { Peak } from '../types';

export function drawPeaks(
  ctx: CanvasRenderingContext2D, 
  peaks: Peak[], 
  now: number,
  canvas: HTMLCanvasElement
) {
  peaks.forEach(peak => {
    const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
    const y = (canvas.height / 2) - 60 - peak.value;
    
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
}
