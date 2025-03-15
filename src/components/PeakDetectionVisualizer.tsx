
import React, { useEffect, useRef } from 'react';

interface PeakDetectionVisualizerProps {
  signalBuffer: number[];
  detectedPeaks: number[];
  isActive: boolean;
  width?: number;
  height?: number;
}

/**
 * Componente que visualiza la señal PPG y los picos detectados en tiempo real
 * Utiliza canvas para renderizado eficiente de datos de alta frecuencia
 */
const PeakDetectionVisualizer: React.FC<PeakDetectionVisualizerProps> = ({
  signalBuffer = [],
  detectedPeaks = [],
  isActive = false,
  width = 300,
  height = 100
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Renderizar la señal y los picos detectados
  useEffect(() => {
    if (!canvasRef.current || !isActive || signalBuffer.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Configuración de visualización
    const padding = 10;
    const graphWidth = canvas.width - (padding * 2);
    const graphHeight = canvas.height - (padding * 2);
    
    // Normalización de datos para visualización
    const minValue = Math.min(...signalBuffer);
    const maxValue = Math.max(...signalBuffer);
    const valueRange = Math.max(maxValue - minValue, 0.001); // Evitar división por cero
    
    // Dibujar línea base
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    
    // Dibujar señal PPG
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    signalBuffer.forEach((value, index) => {
      const x = padding + (index / (signalBuffer.length - 1)) * graphWidth;
      const normalizedValue = (value - minValue) / valueRange;
      const y = canvas.height - padding - (normalizedValue * graphHeight);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Dibujar picos detectados
    ctx.fillStyle = '#ef4444';
    detectedPeaks.forEach(peakIndex => {
      if (peakIndex >= 0 && peakIndex < signalBuffer.length) {
        const x = padding + (peakIndex / (signalBuffer.length - 1)) * graphWidth;
        const normalizedValue = (signalBuffer[peakIndex] - minValue) / valueRange;
        const y = canvas.height - padding - (normalizedValue * graphHeight);
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    // Añadir etiquetas
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.fillText('tiempo →', canvas.width - 50, canvas.height - 2);
    ctx.save();
    ctx.translate(5, canvas.height - 30);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('intensidad', 0, 0);
    ctx.restore();
    
  }, [signalBuffer, detectedPeaks, isActive]);
  
  if (!isActive) return null;
  
  return (
    <div className="w-full flex flex-col items-center">
      <div className="text-xs text-gray-500 mb-1">Análisis de Picos</div>
      <div className="w-full bg-black/5 backdrop-blur-sm rounded-lg p-2 border border-gray-200/30">
        <canvas 
          ref={canvasRef} 
          width={width} 
          height={height}
          className="w-full"
        />
      </div>
    </div>
  );
};

export default PeakDetectionVisualizer;
