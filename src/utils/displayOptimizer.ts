
/**
 * Helper functions for optimizing display in PPG signal visualization
 */

/**
 * Get the appropriate color for signal path based on arrhythmia status
 */
export function getSignalColor(isArrhythmia: boolean): string {
  return isArrhythmia ? '#DC2626' : '#0EA5E9';
}

/**
 * Check if a point is within an arrhythmia window
 */
export function isPointInArrhythmiaWindow(
  pointTime: number, 
  arrhythmiaWindows: Array<{ start: number, end: number }>,
  now: number
): boolean {
  return arrhythmiaWindows.some(window => {
    // Consider the window active if it's recent (within 3 seconds)
    const windowAge = now - window.end;
    const isRecentWindow = windowAge < 3000;
    
    return isRecentWindow && pointTime >= window.start && pointTime <= window.end;
  });
}

/**
 * Optimize canvas for device pixel ratio
 */
export function optimizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
}

/**
 * Optimize HTML element for better rendering
 */
export function optimizeElement(element: HTMLElement): void {
  element.style.transform = 'translateZ(0)';
  element.style.backfaceVisibility = 'hidden';
  element.style.perspective = '1000px';
}

/**
 * Check if the current device is mobile
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Format vital signs data for display
 * Garantiza que los datos de signos vitales sean válidos y tengan un formato adecuado para mostrar
 */
export function formatVitalSigns(data: { 
  heartRate?: number; 
  spo2?: number; 
  pressure?: string;
  arrhythmiaCount?: number | string;
}) {
  // Verificar que todos los valores sean válidos y asignar valores por defecto si son nulos o indefinidos
  return {
    heartRate: data.heartRate !== undefined && data.heartRate > 0 ? data.heartRate : "--",
    spo2: data.spo2 !== undefined && data.spo2 > 0 ? data.spo2 : "--",
    pressure: data.pressure || "--/--",
    arrhythmiaCount: data.arrhythmiaCount || "--"
  };
}

/**
 * Generate medical-style time grid markers
 */
export function generateTimeGridMarkers(
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number, 
  timeStep: number = 250, // ms per grid section
  pixelsPerMs: number = 0.2
): void {
  const now = Date.now();
  
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(120, 120, 120, 0.2)';
  ctx.lineWidth = 1;
  
  // Major time markers (every second)
  for (let t = 0; t < 5000; t += 1000) {
    const x = width - (t * pixelsPerMs);
    if (x < 0) continue;
    
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    
    // Add time label
    ctx.fillStyle = 'rgba(80, 80, 80, 0.7)';
    ctx.font = '10px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${t/1000}s`, x, height - 5);
  }
  
  ctx.stroke();
  
  // Minor time markers
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(150, 150, 150, 0.1)';
  ctx.lineWidth = 0.5;
  
  for (let t = 0; t < 5000; t += timeStep) {
    if (t % 1000 === 0) continue; // Skip major markers
    
    const x = width - (t * pixelsPerMs);
    if (x < 0) continue;
    
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  
  ctx.stroke();
}

/**
 * Draw professional PPG baseline and amplitude reference
 */
export function drawPPGReference(
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number
): void {
  const centerY = height / 2;
  
  // Draw baseline
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(40, 40, 40, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 3]);
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw amplitude reference lines
  const amplitudeStep = 30;
  const maxAmplitude = 4;
  
  ctx.font = '9px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(60, 60, 60, 0.5)';
  
  for (let i = 1; i <= maxAmplitude; i++) {
    // Upper amplitude line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.15)';
    ctx.lineWidth = 0.5;
    ctx.moveTo(0, centerY - (i * amplitudeStep));
    ctx.lineTo(width, centerY - (i * amplitudeStep));
    ctx.stroke();
    
    // Upper amplitude label
    ctx.fillText(`+${i}`, 5, centerY - (i * amplitudeStep) - 3);
    
    // Lower amplitude line
    ctx.beginPath();
    ctx.moveTo(0, centerY + (i * amplitudeStep));
    ctx.lineTo(width, centerY + (i * amplitudeStep));
    ctx.stroke();
    
    // Lower amplitude label
    ctx.fillText(`-${i}`, 5, centerY + (i * amplitudeStep) + 10);
  }
}

/**
 * Renderiza la información de signos vitales en una posición específica del canvas
 */
export function renderVitalSignsOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  vitalSigns: {
    heartRate: number | string;
    spo2: number | string;
    pressure: string;
    arrhythmiaCount: number | string;
  }
): void {
  const padding = 15;
  const topOffset = 30;
  const lineHeight = 25;
  
  // Configurar estilo para el texto
  ctx.font = 'bold 16px "Inter", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  
  // Dibujar fondo semitransparente para mejor legibilidad
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(padding, topOffset, width - (padding * 2), lineHeight * 4 + 20);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(padding, topOffset, width - (padding * 2), lineHeight * 4 + 20);
  
  // Renderizar cada signo vital
  ctx.fillStyle = '#FFFFFF';
  
  // Frecuencia cardíaca
  ctx.fillText(`FC: ${vitalSigns.heartRate} BPM`, padding + 10, topOffset + lineHeight);
  
  // SpO2
  ctx.fillText(`SpO2: ${vitalSigns.spo2}%`, padding + 10, topOffset + lineHeight * 2);
  
  // Presión arterial
  ctx.fillText(`PA: ${vitalSigns.pressure} mmHg`, padding + 10, topOffset + lineHeight * 3);
  
  // Arritmias
  ctx.fillText(`Arritmias: ${vitalSigns.arrhythmiaCount}`, padding + 10, topOffset + lineHeight * 4);
}
