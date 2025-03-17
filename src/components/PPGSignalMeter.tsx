
import React, { useRef, useEffect, useState } from 'react';

interface PPGSignalMeterProps {
  value: number;
  quality: number;
  isFingerDetected: boolean;
  onStartMeasurement: () => void;
  onReset: () => void;
}

const PPGSignalMeter: React.FC<PPGSignalMeterProps> = ({
  value,
  quality,
  isFingerDetected,
  onStartMeasurement,
  onReset
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [signalPoints, setSignalPoints] = useState<{x: number, y: number}[]>([]);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  
  // Initialize canvas dimensions
  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        setCanvasWidth(rect.width);
        setCanvasHeight(rect.height);
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);
  
  // Update signal points
  useEffect(() => {
    if (canvasWidth === 0 || canvasHeight === 0) return;
    
    setSignalPoints(prev => {
      const newPoints = [...prev];
      const now = Date.now();
      
      // Add new point
      newPoints.push({
        x: canvasWidth,
        y: canvasHeight / 2 - (value * canvasHeight * 0.4)
      });
      
      // Move all points left
      const shiftAmount = 2;
      for (let i = 0; i < newPoints.length; i++) {
        newPoints[i].x -= shiftAmount;
      }
      
      // Remove points that are off screen
      const filteredPoints = newPoints.filter(point => point.x > 0);
      
      // Limit number of points
      const MAX_POINTS = 500;
      return filteredPoints.slice(-MAX_POINTS);
    });
  }, [value, canvasWidth, canvasHeight]);
  
  // Draw signal on canvas
  useEffect(() => {
    if (!canvasRef.current || signalPoints.length < 2) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw baseline
    ctx.beginPath();
    ctx.moveTo(0, canvasHeight / 2);
    ctx.lineTo(canvasWidth, canvasHeight / 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw signal
    ctx.beginPath();
    ctx.moveTo(signalPoints[0].x, signalPoints[0].y);
    
    for (let i = 1; i < signalPoints.length; i++) {
      ctx.lineTo(signalPoints[i].x, signalPoints[i].y);
    }
    
    // Gradient color based on signal quality
    let color = 'rgba(255, 0, 0, 0.8)'; // Default red for poor quality
    
    if (quality >= 0.7) {
      color = 'rgba(0, 255, 0, 0.8)'; // Green for good quality
    } else if (quality >= 0.4) {
      color = 'rgba(255, 165, 0, 0.8)'; // Orange for medium quality
    }
    
    // If finger not detected, use gray
    if (!isFingerDetected) {
      color = 'rgba(150, 150, 150, 0.6)';
    }
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    // Draw finger detection status
    ctx.font = '16px sans-serif';
    ctx.fillStyle = isFingerDetected ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)';
    ctx.textAlign = 'left';
    ctx.fillText(
      isFingerDetected ? 'DEDO DETECTADO' : 'COLOQUE SU DEDO EN LA CÁMARA',
      20,
      30
    );
    
    // Draw quality status
    if (isFingerDetected) {
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      
      let qualityText = 'CALIDAD DE SEÑAL: POBRE';
      if (quality >= 0.7) {
        qualityText = 'CALIDAD DE SEÑAL: BUENA';
      } else if (quality >= 0.4) {
        qualityText = 'CALIDAD DE SEÑAL: MEDIA';
      }
      
      ctx.fillText(qualityText, 20, 60);
    }
    
  }, [signalPoints, canvasWidth, canvasHeight, quality, isFingerDetected]);
  
  return (
    <div className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full bg-black"
      />
    </div>
  );
};

export default PPGSignalMeter;
