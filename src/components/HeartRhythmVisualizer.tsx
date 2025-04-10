
import React, { useEffect, useRef } from 'react';

interface HeartRhythmVisualizerProps {
  data: number[];
  width?: number;
  height?: number;
  lineColor?: string;
  arrhythmiaWindows?: { start: number; end: number }[];
}

const HeartRhythmVisualizer: React.FC<HeartRhythmVisualizerProps> = ({ 
  data, 
  width = 200, 
  height = 50,
  lineColor = "#9b87f5",
  arrhythmiaWindows = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw background for arrhythmia sections
    arrhythmiaWindows.forEach(window => {
      const startX = (window.start / data.length) * width;
      const endX = (window.end / data.length) * width;
      
      ctx.fillStyle = 'rgba(255, 50, 50, 0.15)';
      ctx.fillRect(startX, 0, endX - startX, height);
    });
    
    // Calculate scaling factors
    const maxVal = Math.max(...data, 1);
    const minVal = Math.min(...data, -1);
    const range = maxVal - minVal;
    const verticalScale = (height * 0.8) / range;
    const horizontalScale = width / (data.length - 1);
    
    // Start new path for the signal
    ctx.beginPath();
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    
    // Draw the signal line
    data.forEach((value, index) => {
      const x = index * horizontalScale;
      // Normalize the value to fit within canvas, with inverted y-axis
      const y = height - ((value - minVal) * verticalScale + (height * 0.1));
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Add grid lines
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines
    const gridSpacing = height / 4;
    for (let i = 1; i < 4; i++) {
      const y = i * gridSpacing;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    
    // Vertical grid lines
    const verticalSpacing = width / 5;
    for (let i = 1; i < 5; i++) {
      const x = i * verticalSpacing;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    
    ctx.stroke();
  }, [data, width, height, lineColor, arrhythmiaWindows]);

  return (
    <canvas 
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded-md"
    />
  );
};

export default HeartRhythmVisualizer;
