
import React, { useEffect, useRef, useCallback, useState, memo } from 'react';
import { Fingerprint } from 'lucide-react';
import { CircularBuffer, PPGDataPoint } from '../utils/CircularBuffer';
import { useHeartbeatFeedback } from '../hooks/useHeartbeatFeedback';
import { evaluateSignalQuality } from '../core/RealSignalQualityEvaluator';
import { validateFullSignal, SignalValidationResult } from '../core/RealSignalValidator';
import SignalValidationBox from './SignalValidationBox';

const CANVAS_WIDTH = 280;
const CANVAS_HEIGHT = 120;
const MAX_DATA_POINTS = 140;
const PEAK_DETECT_THRESHOLD = 0.3;

interface PPGSignalMeterProps {
  value: number;
  quality: number;
  isFingerDetected: boolean;
  onStartMeasurement: () => void;
  onReset: () => void;
  arrhythmiaStatus: string;
  preserveResults?: boolean;
  isArrhythmia?: boolean;
}

const PPGSignalMeter = memo(({ 
  value, quality, isFingerDetected, onStartMeasurement, onReset,
  arrhythmiaStatus, preserveResults = false, isArrhythmia = false
}: PPGSignalMeterProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataBufferRef = useRef(new CircularBuffer<PPGDataPoint>(MAX_DATA_POINTS));
  const animationFrameRef = useRef<number | null>(null);
  const lastPeakTimeRef = useRef<number>(0);
  const { playHeartbeat } = useHeartbeatFeedback(isFingerDetected, isArrhythmia);
  const verticalScale = 255;

  const [signalLevel, setSignalLevel] = useState(0);
  const [signalColor, setSignalColor] = useState('gray');
  const [signalLabel, setSignalLabel] = useState('Desconocida');
  const [validationResult, setValidationResult] = useState<SignalValidationResult>({
    valid: true,
    level: 0,
    color: 'gray',
    label: 'Iniciando...',
    warnings: []
  });

  useEffect(() => {
    if (dataBufferRef.current && dataBufferRef.current.getPoints().length > 10) {
      const rawValues = dataBufferRef.current.getPoints().map(p => p.value / verticalScale);
      
      // Evaluación básica de calidad 
      const result = evaluateSignalQuality(rawValues);
      setSignalLevel(result.level);
      setSignalColor(result.color);
      setSignalLabel(result.label);
      
      // Validación avanzada
      const validation = validateFullSignal(rawValues);
      setValidationResult(validation);
    }
  }, [value]);

  const renderSignal = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const points = dataBufferRef.current ? dataBufferRef.current.getPoints() : [];

    ctx.beginPath();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#34D399';

    if (points.length > 0) {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
    }
    ctx.stroke();
  }, []);

  const detectPeaks = useCallback(() => {
    const points = dataBufferRef.current ? dataBufferRef.current.getPoints() : [];
    if (points.length < 3) return;

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1].value;
      const curr = points[i].value;
      const next = points[i + 1].value;

      if (curr > prev && curr > next && curr > PEAK_DETECT_THRESHOLD) {
        const now = Date.now();
        if (now - lastPeakTimeRef.current > 300) {
          playHeartbeat();
          lastPeakTimeRef.current = now;
        }
        break;
      }
    }
  }, [playHeartbeat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let x = 0;

    const animate = () => {
      if (!canvas) return;

      const y = CANVAS_HEIGHT - ((value / verticalScale) * CANVAS_HEIGHT);
      const now = Date.now();

      dataBufferRef.current?.add({ x, y, value, time: now });
      renderSignal();
      detectPeaks();

      x = (x + 2) % CANVAS_WIDTH;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, renderSignal, detectPeaks, verticalScale]);

  return (
    <div className="fixed inset-0 bg-black/5 backdrop-blur-[1px] flex flex-col transform-gpu">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="absolute inset-0 z-0"
      />
      
      {/* NUEVO SENSOR DE CALIDAD REAL Y VALIDACIÓN */}
      <div className="absolute top-2 left-2 z-20">
        <SignalValidationBox result={validationResult} />
      </div>

      {/* PANEL SUPERIOR: DETECCIÓN DEDO (conservado) */}
      <div className="absolute top-0 right-0 p-2 z-10">
        <div className="flex flex-col items-center">
          <Fingerprint
            className={`h-8 w-8 transition-colors duration-300 ${
              !isFingerDetected ? 'text-gray-400' :
              signalLevel > 0.85 ? 'text-green-500' :
              signalLevel > 0.6 ? 'text-yellow-500' : 'text-red-500'
            }`}
            strokeWidth={1.5}
          />
          <span className="text-[10px] text-gray-600">{isFingerDetected ? "Dedo detectado" : "Ubique su dedo"}</span>
        </div>
      </div>

      {/* BOTONES (conservado) */}
      <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-around z-10">
        {!preserveResults && (
          <button
            onClick={onStartMeasurement}
            className="bg-emerald-500 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Iniciar Medición
          </button>
        )}
        <button
          onClick={onReset}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Reiniciar
        </button>
      </div>
    </div>
  );
});

PPGSignalMeter.displayName = 'PPGSignalMeter';
export default PPGSignalMeter;
