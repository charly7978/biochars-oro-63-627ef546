
import React, { useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DataPoint {
  time: number;
  value: number;
}

interface SignalVisualizerCardProps {
  rawSignal: DataPoint[];
  filteredSignal: DataPoint[];
  amplifiedSignal: DataPoint[];
}

const SignalVisualizerCard: React.FC<SignalVisualizerCardProps> = ({ 
  rawSignal, 
  filteredSignal,
  amplifiedSignal
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Draw signal on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set up dimensions
    const width = canvas.width;
    const height = canvas.height;
    const padding = 20;
    
    // Find min/max values for scaling
    const allValues = [
      ...rawSignal.map(point => point.value),
      ...filteredSignal.map(point => point.value),
      ...amplifiedSignal.map(point => point.value)
    ];
    
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const valueRange = Math.max(0.01, maxValue - minValue);
    
    // Calculate time range (assuming timestamps are in milliseconds)
    const timeValues = [
      ...rawSignal.map(point => point.time),
      ...filteredSignal.map(point => point.time),
      ...amplifiedSignal.map(point => point.time)
    ];
    
    const minTime = Math.min(...timeValues);
    const maxTime = Math.max(...timeValues);
    const timeRange = Math.max(1, maxTime - minTime);
    
    // Draw grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 0.5;
    
    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = padding + (width - 2 * padding) * (i / 10);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }
    
    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padding + (height - 2 * padding) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Helper function to map a data point to canvas coordinates
    const mapToCanvas = (point: DataPoint) => {
      const x = padding + ((point.time - minTime) / timeRange) * (width - 2 * padding);
      const y = height - padding - ((point.value - minValue) / valueRange) * (height - 2 * padding);
      return { x, y };
    };
    
    // Draw signals
    const drawSignal = (points: DataPoint[], color: string, lineWidth: number) => {
      if (points.length < 2) return;
      
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      
      const firstPoint = mapToCanvas(points[0]);
      ctx.moveTo(firstPoint.x, firstPoint.y);
      
      for (let i = 1; i < points.length; i++) {
        const point = mapToCanvas(points[i]);
        ctx.lineTo(point.x, point.y);
      }
      
      ctx.stroke();
    };
    
    // Draw all signals
    drawSignal(rawSignal, '#c0c0c0', 1); // Gray for raw signal
    drawSignal(filteredSignal, '#3b82f6', 1.5); // Blue for filtered
    drawSignal(amplifiedSignal, '#10b981', 2); // Green for amplified
    
    // Draw legend
    const legendY = height - 10;
    
    // Raw signal
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(width - 150, legendY, 10, 2);
    ctx.fillStyle = '#000000';
    ctx.font = '10px sans-serif';
    ctx.fillText('Raw', width - 135, legendY + 3);
    
    // Filtered signal
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(width - 100, legendY, 10, 2);
    ctx.fillStyle = '#000000';
    ctx.fillText('Filtered', width - 85, legendY + 3);
    
    // Amplified signal
    ctx.fillStyle = '#10b981';
    ctx.fillRect(width - 50, legendY, 10, 2);
    ctx.fillStyle = '#000000';
    ctx.fillText('Amplified', width - 35, legendY + 3);
    
  }, [rawSignal, filteredSignal, amplifiedSignal]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Signal Visualization</CardTitle>
        <CardDescription>
          Real-time signal trace visualization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <canvas 
          ref={canvasRef} 
          width={500} 
          height={200} 
          className="w-full h-48 bg-white"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <div>Time (ms)</div>
          <div>Samples: {filteredSignal.length}</div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SignalVisualizerCard;
