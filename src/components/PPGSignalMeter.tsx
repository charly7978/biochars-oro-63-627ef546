
import React, { useEffect, useRef, useCallback, useState, memo } from 'react';
import { Fingerprint } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';
import AudioFeedbackService from '../services/AudioFeedbackService';
import ArrhythmiaDetectionService from '../services/ArrhythmiaDetectionService';

interface PPGSignalMeterProps {
  value: number;
  quality: number;
  isFingerDetected: boolean;
  onStartMeasurement: () => void;
  onReset: () => void;
  arrhythmiaStatus?: string;
  rawArrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
  preserveResults?: boolean;
  isArrhythmia?: boolean;
  arrhythmiaWindows?: { start: number, end: number }[];
}

interface PPGDataPointExtended extends PPGDataPoint {
  isArrhythmia?: boolean;
}

const PPGSignalMeter = memo(({ 
  value, 
  quality, 
  isFingerDetected,
  onStartMeasurement,
  onReset,
  arrhythmiaStatus,
  rawArrhythmiaData,
  preserveResults = false,
  isArrhythmia = false,
  arrhythmiaWindows = []
}: PPGSignalMeterProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataBufferRef = useRef<CircularBuffer<PPGDataPointExtended> | null>(null);
  const baselineRef = useRef<number | null>(null);
  const lastValueRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number>();
  const peaksRef = useRef<{time: number, value: number, isArrhythmia: boolean, beepPlayed?: boolean}[]>([]);
  const [showArrhythmiaAlert, setShowArrhythmiaAlert] = useState(false);
  const qualityHistoryRef = useRef<number[]>([]);
  const consecutiveFingerFramesRef = useRef<number>(0);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentArrhythmiaSegmentRef = useRef<any>(null);
  const lastBeepTimeRef = useRef<number>(0);

  const WINDOW_WIDTH_MS = 4500;
  const CANVAS_WIDTH = 1100;
  const CANVAS_HEIGHT = 1200;
  const GRID_SIZE_X = 5;
  const GRID_SIZE_Y = 5;
  const verticalAmplification = 80.0; // Amplificación leve para señal cruda (antes 76.0)
  const SMOOTHING_FACTOR = 1.6;
  const TARGET_FPS = 60;
  const FRAME_TIME = 1000 / TARGET_FPS;
  const BUFFER_SIZE = 600;
  const PEAK_DETECTION_WINDOW = 8;
  const PEAK_THRESHOLD = 3;
  const MIN_PEAK_DISTANCE_MS = 350;
  const IMMEDIATE_RENDERING = true;
  const MAX_PEAKS_TO_DISPLAY = 25;
  const QUALITY_HISTORY_SIZE = 9;
  const REQUIRED_FINGER_FRAMES = 3;
  const USE_OFFSCREEN_CANVAS = true;
  const MIN_BEEP_INTERVAL_MS = 350;

  const playBeep = useCallback(async (volume: number = 0.7, isArrhythmic: boolean = false) => {
    const now = Date.now();
    if (now - lastBeepTimeRef.current < MIN_BEEP_INTERVAL_MS) {
      return false;
    }
    
    AudioFeedbackService.playBeep(isArrhythmic ? 'arrhythmia' : 'normal', volume);
    lastBeepTimeRef.current = now;
    return true;
  }, [MIN_BEEP_INTERVAL_MS]);

  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer<PPGDataPointExtended>(BUFFER_SIZE);
    }
    
    if (preserveResults && !isFingerDetected) {
      // Mantener resultados previos visibles sin alterar señal
    } else if (!preserveResults && !isFingerDetected) {
      if (dataBufferRef.current) {
        dataBufferRef.current.clear();
      }
      peaksRef.current = [];
      baselineRef.current = null;
      lastValueRef.current = null;
    }
  }, [preserveResults, isFingerDetected]);

  useEffect(() => {
    qualityHistoryRef.current.push(quality);
    if (qualityHistoryRef.current.length > QUALITY_HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    if (isFingerDetected) {
      consecutiveFingerFramesRef.current++;
    } else {
      consecutiveFingerFramesRef.current = 0;
    }
  }, [quality, isFingerDetected]);

  useEffect(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_WIDTH;
    offscreen.height = CANVAS_HEIGHT;
    offscreenCanvasRef.current = offscreen;

    const gridCanvas = document.createElement('canvas');
    gridCanvas.width = CANVAS_WIDTH;
    gridCanvas.height = CANVAS_HEIGHT;
    const gridCtx = gridCanvas.getContext('2d', { alpha: false });

    if(gridCtx) {
      drawGrid(gridCtx);
    }
  }, []);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.3;

    for(let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE_X) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }

    for(let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE_Y) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }
  }, [CANVAS_WIDTH, CANVAS_HEIGHT, GRID_SIZE_X, GRID_SIZE_Y]);

  const detectPeaks = useCallback((points: PPGDataPointExtended[], now: number) => {
    if (points.length < PEAK_DETECTION_WINDOW) return;

    for (let i = PEAK_DETECTION_WINDOW; i < points.length - PEAK_DETECTION_WINDOW; i++) {
      const currentPoint = points[i];
      let isPeak = true;

      for (let j = i - PEAK_DETECTION_WINDOW; j < i; j++) {
        if (points[j].value >= currentPoint.value) {
          isPeak = false;
          break;
        }
      }

      for (let j = i + 1; j <= i + PEAK_DETECTION_WINDOW; j++) {
        if (points[j] && points[j].value > currentPoint.value) {
          isPeak = false;
          break;
        }
      }

      if (isPeak && Math.abs(currentPoint.value) > PEAK_THRESHOLD) {
        const tooClose = peaksRef.current.some(
          peak => Math.abs(peak.time - currentPoint.time) < MIN_PEAK_DISTANCE_MS
        );

        if (!tooClose) {
          peaksRef.current.push({ time: currentPoint.time, value: currentPoint.value, isArrhythmia: currentPoint.isArrhythmia || false, beepPlayed: false });
        }
      }
    }

    const nowLimit = now - WINDOW_WIDTH_MS;
    peaksRef.current = peaksRef.current.filter(p => p.time > nowLimit);
    if (peaksRef.current.length > MAX_PEAKS_TO_DISPLAY) {
      peaksRef.current = peaksRef.current.slice(-MAX_PEAKS_TO_DISPLAY);
    }
  }, [PEAK_DETECTION_WINDOW, PEAK_THRESHOLD, MIN_PEAK_DISTANCE_MS, WINDOW_WIDTH_MS, MAX_PEAKS_TO_DISPLAY]);

  const renderSignal = useCallback(() => {
    if (!canvasRef.current || !dataBufferRef.current) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      animationFrameRef.current = requestAnimationFrame(renderSignal);
      return;
    }

    const now = Date.now();

    // Clear background
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const points = dataBufferRef.current.getPoints();
    detectPeaks(points, now);

    // Draw waveform
    ctx.beginPath();
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 2;

    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];

      const x0 = canvas.width - ((now - p0.time) * canvas.width / WINDOW_WIDTH_MS);
      const y0 = CANVAS_HEIGHT / 2 - p0.value * verticalAmplification;

      const x1 = canvas.width - ((now - p1.time) * canvas.width / WINDOW_WIDTH_MS);
      const y1 = CANVAS_HEIGHT / 2 - p1.value * verticalAmplification;

      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();

    // Draw peaks
    peaksRef.current.forEach(peak => {
      const x = canvas.width - ((now - peak.time) * canvas.width / WINDOW_WIDTH_MS);
      const y = CANVAS_HEIGHT / 2 - peak.value * verticalAmplification;

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = peak.isArrhythmia ? '#FF4444' : '#00FFCC';
      ctx.fill();

      if (!peak.beepPlayed && isFingerDetected) {
        AudioFeedbackService.playBeep(peak.isArrhythmia ? 'arrhythmia' : 'normal', 0.8);
        peak.beepPlayed = true;
      }
    });

    animationFrameRef.current = requestAnimationFrame(renderSignal);
  }, [detectPeaks, verticalAmplification, isFingerDetected, WINDOW_WIDTH_MS, CANVAS_HEIGHT]);

  useEffect(() => {
    renderSignal();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderSignal]);

  useEffect(() => {
    if (!dataBufferRef.current) {
      dataBufferRef.current = new CircularBuffer<PPGDataPointExtended>(BUFFER_SIZE);
    }
    if (isFingerDetected) {
      const now = Date.now();

      // Guardamos valor sin ningún ajuste ni suavizado en el buffer
      dataBufferRef.current.push({time: now, value: value, isArrhythmia: isArrhythmia});
    }
  }, [value, isFingerDetected, isArrhythmia]);

  const getAverageQuality = () => {
    if (qualityHistoryRef.current.length === 0) return 0;

    let weightedSum = 0;
    let weightSum = 0;

    qualityHistoryRef.current.forEach((q, index) => {
      const weight = index + 1;
      weightedSum += q * weight;
      weightSum += weight;
    });

    return weightSum > 0 ? weightedSum / weightSum : 0;
  };

  const getQualityColorClass = () => {
    const avgQuality = getAverageQuality();

    if (!(consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES)) return 'text-gray-400';
    if (avgQuality > 65) return 'text-green-500';
    if (avgQuality > 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getQualityText = () => {
    const avgQuality = getAverageQuality();

    if (!(consecutiveFingerFramesRef.current >= REQUIRED_FINGER_FRAMES)) return 'No finger detected';
    if (avgQuality > 65) return 'Optimal signal';
    if (avgQuality > 40) return 'Acceptable signal';
    return 'Weak signal';
  };

  return (
    <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex flex-col">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="absolute inset-0 z-0 object-cover"
        style={{
          imageRendering: 'crisp-edges',
          backfaceVisibility: 'hidden',
        }}
      />
      <div className="relative flex justify-between items-center bg-transparent z-10 p-3 text-white">
        <div className="flex items-center gap-2">
          <Fingerprint className={`h-8 w-8 ${getQualityColorClass()}`} strokeWidth={1.5} />
          <span className={`text-sm font-semibold ${getQualityColorClass()}`}>
            {getQualityText()}
          </span>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={onStartMeasurement}
            className="rounded bg-green-600 px-3 py-1 text-sm font-semibold hover:bg-green-700"
          >
            INICIAR
          </button>
          <button
            onClick={onReset}
            className="rounded bg-red-600 px-3 py-1 text-sm font-semibold hover:bg-red-700"
          >
            RESET
          </button>
        </div>
      </div>
    </div>
  );
});

PPGSignalMeter.displayName = "PPGSignalMeter";

export default PPGSignalMeter;
