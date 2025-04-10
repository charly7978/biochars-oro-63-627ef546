
import React, { useEffect, useRef } from 'react';
import { HRVAnalysisResult } from '@/hooks/heart-beat/use-hrv-analysis';

interface HeartRateVariabilityChartProps {
  data: number[];
  hrvResult?: HRVAnalysisResult | null;
  width?: number;
  height?: number;
  lineColor?: string;
  showGrid?: boolean;
  showMetrics?: boolean;
}

const HeartRateVariabilityChart: React.FC<HeartRateVariabilityChartProps> = ({
  data,
  hrvResult,
  width = 300,
  height = 150,
  lineColor = '#0EA5E9',
  showGrid = true,
  showMetrics = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid if enabled
    if (showGrid) {
      drawGrid(ctx, canvas.width, canvas.height);
    }
    
    // Draw HRV data
    drawHRVData(ctx, data, canvas.width, canvas.height, lineColor);
    
    // Draw metrics if available and enabled
    if (showMetrics && hrvResult) {
      drawMetrics(ctx, hrvResult, canvas.width, canvas.height);
    }
  }, [data, hrvResult, width, height, lineColor, showGrid, showMetrics]);
  
  const drawGrid = (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number
  ) => {
    const gridSizeX = 30;
    const gridSizeY = 15;
    
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    
    // Draw vertical grid lines
    for (let x = 0; x <= width; x += gridSizeX) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Draw horizontal grid lines
    for (let y = 0; y <= height; y += gridSizeY) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };
  
  const drawHRVData = (
    ctx: CanvasRenderingContext2D, 
    data: number[], 
    width: number, 
    height: number,
    color: string
  ) => {
    if (data.length < 2) return;
    
    // Find min and max values for scaling
    const minValue = Math.min(...data);
    const maxValue = Math.max(...data);
    const range = maxValue - minValue;
    
    // Use normalized scaling or fixed scaling if range is small
    const valueRange = range > 50 ? range : 200;
    const midPoint = (minValue + maxValue) / 2;
    const scaledMin = midPoint - valueRange / 2;
    const scaledMax = midPoint + valueRange / 2;
    
    // Draw line connecting RR intervals
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    
    const stepX = width / (data.length - 1);
    
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const normalizedValue = (data[i] - scaledMin) / (scaledMax - scaledMin);
      const y = height - (normalizedValue * height);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
    
    // Draw dots at each point
    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const normalizedValue = (data[i] - scaledMin) / (scaledMax - scaledMin);
      const y = height - (normalizedValue * height);
      
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  
  const drawMetrics = (
    ctx: CanvasRenderingContext2D, 
    metrics: HRVAnalysisResult, 
    width: number, 
    height: number
  ) => {
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    // Background for metrics
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(10, 10, 150, 80);
    
    ctx.fillStyle = '#334155';
    
    // Draw key metrics
    ctx.fillText(`SDNN: ${metrics.sdnn.toFixed(1)} ms`, 15, 15);
    ctx.fillText(`RMSSD: ${metrics.rmssd.toFixed(1)} ms`, 15, 35);
    ctx.fillText(`pNN50: ${metrics.pnn50.toFixed(1)}%`, 15, 55);
    
    // Draw arrhythmia indicator if detected
    if (metrics.hasArrhythmia) {
      ctx.fillStyle = '#DC2626';
      ctx.fillText('⚠️ Posible arritmia', 15, 75);
    }
  };
  
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="rounded-md"
    />
  );
};

export default HeartRateVariabilityChart;
