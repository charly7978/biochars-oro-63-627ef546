
import React, { memo, useRef, useEffect } from 'react';

interface HRVVisualizationProps {
  rrIntervals: number[];
  width?: number;
  height?: number;
  isArrhythmia?: boolean;
  className?: string;
}

/**
 * Visualizes Heart Rate Variability using a small, efficient graph
 * that highlights irregular heartbeats without being visually intrusive
 */
const HRVVisualization = memo(({
  rrIntervals,
  width = 120,
  height = 40,
  isArrhythmia = false,
  className = ''
}: HRVVisualizationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current || rrIntervals.length < 2) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set up drawing
    const padding = 4;
    const innerWidth = canvas.width - padding * 2;
    const innerHeight = canvas.height - padding * 2;
    
    // Normalize intervals to fit our visualization space
    const maxInterval = Math.max(...rrIntervals, 1200);
    const minInterval = Math.min(...rrIntervals, 600);
    const range = maxInterval - minInterval;
    
    // Draw baseline
    ctx.strokeStyle = isArrhythmia ? 'rgba(234, 88, 82, 0.3)' : 'rgba(120, 190, 120, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding + innerHeight / 2);
    ctx.lineTo(padding + innerWidth, padding + innerHeight / 2);
    ctx.stroke();
    
    // Draw interval lines
    ctx.lineWidth = 2;
    ctx.strokeStyle = isArrhythmia ? 'rgba(234, 88, 82, 0.7)' : 'rgba(120, 190, 120, 0.7)';
    
    const displayPoints = Math.min(rrIntervals.length, 10);
    const stepX = innerWidth / (displayPoints - 1);
    
    ctx.beginPath();
    
    for (let i = 0; i < displayPoints; i++) {
      const interval = rrIntervals[rrIntervals.length - displayPoints + i];
      
      // Normalize value (60-150 BPM range approximately)
      const normalizedHeight = ((interval - minInterval) / range) * innerHeight;
      const invertedY = padding + innerHeight - normalizedHeight;
      
      const x = padding + i * stepX;
      
      if (i === 0) {
        ctx.moveTo(x, invertedY);
      } else {
        ctx.lineTo(x, invertedY);
      }
    }
    
    ctx.stroke();
    
    // Add arrhythmia markers if needed
    if (isArrhythmia) {
      const recentIntervals = rrIntervals.slice(-displayPoints);
      const avgInterval = recentIntervals.reduce((sum, val) => sum + val, 0) / recentIntervals.length;
      
      for (let i = 0; i < displayPoints; i++) {
        const interval = rrIntervals[rrIntervals.length - displayPoints + i];
        
        // Mark significant deviations
        if (Math.abs(interval - avgInterval) / avgInterval > 0.15) {
          const normalizedHeight = ((interval - minInterval) / range) * innerHeight;
          const invertedY = padding + innerHeight - normalizedHeight;
          const x = padding + i * stepX;
          
          ctx.fillStyle = 'rgba(255, 70, 70, 0.8)';
          ctx.beginPath();
          ctx.arc(x, invertedY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }, [rrIntervals, isArrhythmia, width, height]);
  
  if (rrIntervals.length < 2) {
    return null;
  }
  
  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height}
      className={`${className}`}
    />
  );
});

HRVVisualization.displayName = 'HRVVisualization';

export default HRVVisualization;
