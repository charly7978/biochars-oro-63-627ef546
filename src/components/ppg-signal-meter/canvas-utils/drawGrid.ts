
import { CANVAS_WIDTH, CANVAS_HEIGHT, GRID_SIZE_X, GRID_SIZE_Y, CANVAS_CENTER_OFFSET } from '../constants';

export function drawGrid(ctx: CanvasRenderingContext2D) {
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
}
