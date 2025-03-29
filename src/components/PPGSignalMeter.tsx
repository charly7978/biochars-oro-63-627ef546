import React, { useEffect, useRef, useCallback, useState, memo } from 'react';
import { Fingerprint, AlertCircle } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';
import AppTitle from './AppTitle';
import { useHeartbeatFeedback } from '../hooks/useHeartbeatFeedback';
import { beatDispatcher } from '../core/BeatDispatcher';

interface PPGSignalMeterProps {
  value: number;
  quality: number;
  isFingerDetected: boolean;
  onStartMeasurement: () => void;
  onReset: () => void;
  arrhythmiaStatus: string;
  preserveResults: boolean;
  isArrhythmia: boolean;
}

interface PPGDataPointExtended extends PPGDataPoint {
  isArrhythmia?: boolean;
}

const PPGSignalMeter: React.FC<PPGSignalMeterProps> = memo(({ 
  value, 
  quality, 
  isFingerDetected, 
  onStartMeasurement, 
  onReset,
  arrhythmiaStatus,
  preserveResults,
  isArrhythmia
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signalBufferRef = useRef<CircularBuffer<PPGDataPointExtended>>(new CircularBuffer<PPGDataPointExtended>(300));
  const peaksRef = useRef<{ time: number; value: number; isArrhythmia: boolean; beepPlayed: boolean; }[]>([]);
  const [verticalScale, setVerticalScale] = useState(1);
  const [signalColor, setSignalColor] = useState('#00FF00');
  const [gridColor, setGridColor] = useState('rgba(255, 255, 255, 0.1)');
  const [textColor, setTextColor] = useState('white');
  const [isArrhythmiaDetected, setIsArrhythmiaDetected] = useState(false);
  const [showArrhythmiaAlert, setShowArrhythmiaAlert] = useState(false);
  const [lastArrhythmiaTime, setLastArrhythmiaTime] = useState(0);
  const [lastSignalQuality, setLastSignalQuality] = useState(0);
  const [lastFingerDetected, setLastFingerDetected] = useState(false);
  const [lastValue, setLastValue] = useState(0);
  const [lastArrhythmiaStatus, setLastArrhythmiaStatus] = useState('--');
  const [lastPreserveResults, setLastPreserveResults] = useState(false);
  const [lastIsArrhythmia, setLastIsArrhythmia] = useState(false);
  
  const triggerHeartbeatFeedback = useHeartbeatFeedback(true);
  
  const WINDOW_WIDTH_MS = 5000;
  const PEAK_DETECTION_WINDOW = 5;
  const MIN_PEAK_DISTANCE_MS = 450;
  const MAX_PEAKS_TO_DISPLAY = 5;
  const PEAK_THRESHOLD = 5;
  const ARRHYTHMIA_DISPLAY_DURATION = 5000;
  
  useEffect(() => {
    setLastSignalQuality(quality);
    setLastFingerDetected(isFingerDetected);
    setLastValue(value);
    setLastArrhythmiaStatus(arrhythmiaStatus);
    setLastPreserveResults(preserveResults);
    setLastIsArrhythmia(isArrhythmia);
  }, [quality, isFingerDetected, value, arrhythmiaStatus, preserveResults, isArrhythmia]);
  
  useEffect(() => {
    if (isArrhythmia && Date.now() - lastArrhythmiaTime > ARRHYTHMIA_DISPLAY_DURATION) {
      setIsArrhythmiaDetected(true);
      setShowArrhythmiaAlert(true);
      setLastArrhythmiaTime(Date.now());
      
      const timer = setTimeout(() => {
        setShowArrhythmiaAlert(false);
      }, ARRHYTHMIA_DISPLAY_DURATION);
      
      return () => clearTimeout(timer);
    }
  }, [isArrhythmia, lastArrhythmiaTime]);
  
  useEffect(() => {
    const calculateScale = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const height = canvas.height;
      setVerticalScale(height / 150);
    };
    
    calculateScale();
    window.addEventListener('resize', calculateScale);
    
    return () => {
      window.removeEventListener('resize', calculateScale);
    };
  }, []);
  
  useEffect(() => {
    switch (true) {
      case quality < 30:
        setSignalColor('#FF4136'); // Red
        setGridColor('rgba(255, 65, 54, 0.1)');
        setTextColor('#FF4136');
        break;
      case quality < 60:
        setSignalColor('#FF851B'); // Orange
        setGridColor('rgba(255, 133, 27, 0.1)');
        setTextColor('#FF851B');
        break;
      default:
        setSignalColor('#2ECC40'); // Green
        setGridColor('rgba(46, 204, 64, 0.1)');
        setTextColor('#2ECC40');
        break;
    }
  }, [quality]);
  
  const detectPeaks = useCallback((points: PPGDataPointExtended[], now: number) => {
    if (points.length < PEAK_DETECTION_WINDOW) return;
    
    const potentialPeaks: {index: number, value: number, time: number, isArrhythmia: boolean}[] = [];
    
    for (let i = PEAK_DETECTION_WINDOW; i < points.length - PEAK_DETECTION_WINDOW; i++) {
      const currentPoint = points[i];
      
      const recentlyProcessed = peaksRef.current.some(
        peak => Math.abs(peak.time - currentPoint.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (recentlyProcessed) continue;
      
      let isPeak = true;
      
      // Invert the peak detection logic to find upward peaks
      for (let j = i - PEAK_DETECTION_WINDOW; j < i; j++) {
        if (points[j].value >= currentPoint.value) {
          isPeak = false;
          break;
        }
      }
      
      if (isPeak) {
        for (let j = i + 1; j <= i + PEAK_DETECTION_WINDOW; j++) {
          if (j < points.length && points[j].value >= currentPoint.value) {
            isPeak = false;
            break;
          }
        }
      }
      
      if (isPeak && Math.abs(currentPoint.value) > PEAK_THRESHOLD) {
        potentialPeaks.push({
          index: i,
          value: currentPoint.value,
          time: currentPoint.time,
          isArrhythmia: currentPoint.isArrhythmia || false
        });
      }
    }
    
    for (const peak of potentialPeaks) {
      const tooClose = peaksRef.current.some(
        existingPeak => Math.abs(existingPeak.time - peak.time) < MIN_PEAK_DISTANCE_MS
      );
      
      if (!tooClose) {
        peaksRef.current.push({
          time: peak.time,
          value: peak.value,
          isArrhythmia: peak.isArrhythmia,
          beepPlayed: false
        });
        
        beatDispatcher.dispatchBeat(peak.time / 1000, peak.value / verticalScale);
      }
    }
    
    peaksRef.current.sort((a, b) => a.time - b.time);
    
    peaksRef.current = peaksRef.current
      .filter(peak => now - peak.time < WINDOW_WIDTH_MS)
      .slice(-MAX_PEAKS_TO_DISPLAY);
  }, [MIN_PEAK_DISTANCE_MS, WINDOW_WIDTH_MS, verticalScale]);
  
  const renderSignal = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const renderCtx = canvas.getContext('2d');
    if (!renderCtx) return;
    
    const now = Date.now();
    
    renderCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    const points = signalBufferRef.current.getPoints();
    detectPeaks(points, now);
    
    // Grid setup
    const gridSpacing = 25;
    renderCtx.strokeStyle = gridColor;
    renderCtx.lineWidth = 0.5;
    
    // Vertical grid lines
    for (let i = gridSpacing; i < canvas.width; i += gridSpacing) {
      renderCtx.beginPath();
      renderCtx.moveTo(i, 0);
      renderCtx.lineTo(i, canvas.height);
      renderCtx.stroke();
    }
    
    // Horizontal grid lines
    for (let i = gridSpacing; i < canvas.height; i += gridSpacing) {
      renderCtx.beginPath();
      renderCtx.moveTo(0, i);
      renderCtx.lineTo(canvas.width, i);
      renderCtx.stroke();
    }
    
    if (points.length > 1) {
      // Draw the PPG signal line
      renderCtx.beginPath();
      renderCtx.strokeStyle = signalColor;
      renderCtx.lineWidth = 3;
      
      for (let i = 1; i < points.length; i++) {
        const point = points[i];
        const prevPoint = points[i - 1];
        
        const x1 = canvas.width - ((now - prevPoint.time) * canvas.width / WINDOW_WIDTH_MS);
        const x2 = canvas.width - ((now - point.time) * canvas.width / WINDOW_WIDTH_MS);
        
        // Update these lines to make peaks point upward
        const y1 = canvas.height / 2 + prevPoint.value * verticalScale;
        const y2 = canvas.height / 2 + point.value * verticalScale;
        
        if (i === 1) {
          renderCtx.moveTo(x1, y1);
        }
        
        renderCtx.lineTo(x2, y2);
      }
      
      renderCtx.stroke();
      
      // Draw baseline
      renderCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      renderCtx.lineWidth = 1;
      renderCtx.beginPath();
      renderCtx.moveTo(0, canvas.height / 2);
      renderCtx.lineTo(canvas.width, canvas.height / 2);
      renderCtx.stroke();
      
      // Draw text for arrhythmia status
      renderCtx.fillStyle = textColor;
      renderCtx.font = '16px sans-serif';
      renderCtx.textAlign = 'left';
      renderCtx.textBaseline = 'top';
      renderCtx.fillText(`Estado: ${lastArrhythmiaStatus}`, 10, 10);
    }
    
    // Draw circles at peaks with correct positioning
    peaksRef.current.forEach(peak => {
      const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
      // Update this line to make circles align with upward peaks
      const y = canvas.height / 2 + peak.value * verticalScale;
      
      renderCtx.beginPath();
      renderCtx.arc(x, y, 5, 0, 2 * Math.PI);
      renderCtx.fillStyle = peak.isArrhythmia ? 'red' : 'yellow';
      renderCtx.fill();
    });
  }, [verticalScale, signalColor, gridColor, textColor, lastArrhythmiaStatus, detectPeaks]);
  
  useEffect(() => {
    const animationFrameId = requestAnimationFrame(renderSignal);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [renderSignal, value, quality, isFingerDetected, arrhythmiaStatus, preserveResults, isArrhythmia]);
  
  useEffect(() => {
    signalBufferRef.current.push({
      time: Date.now(),
      value: value,
      isArrhythmia: isArrhythmiaDetected
    });
  }, [value, isArrhythmiaDetected]);
  
  return (
    
    <div className="relative w-full h-full">
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full" 
        style={{ backgroundColor: 'black' }}
      />
      
      {showArrhythmiaAlert && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-red-500 bg-opacity-50 z-20">
          <div className="flex items-center justify-center p-4 bg-red-700 text-white rounded-md shadow-lg">
            <AlertCircle className="mr-2 w-6 h-6" />
            <span className="text-lg font-semibold">¡Arritmia Detectada!</span>
          </div>
        </div>
      )}
      
      {!lastFingerDetected && !lastPreserveResults && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 z-10">
          <Fingerprint className="w-16 h-16 text-gray-500 animate-pulse" />
          <p className="mt-4 text-gray-400 text-lg">
            Por favor, coloque su dedo en la cámara.
          </p>
        </div>
      )}
    </div>
  );
});

PPGSignalMeter.displayName = 'PPGSignalMeter';

export default PPGSignalMeter;
