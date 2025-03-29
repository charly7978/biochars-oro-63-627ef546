
import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, Heart, Clock, Info, X } from "lucide-react";
import { CardiacMetrics } from '../hooks/heart-beat/types';
import { formatRRInterval, getHRVDescription, getQualityDescription, formatBPM, formatDate } from '../utils/displayOptimizer';

interface PPGSummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  signalData: Array<{time: number, value: number, isPeak: boolean, isArrhythmia?: boolean}>;
  cardiacMetrics: CardiacMetrics;
  measurementTime: number;
  vitals: {
    spo2: number | string;
    pressure: string;
    arrhythmiaStatus: string;
  };
}

const PPGSummaryDialog = ({ 
  isOpen, 
  onClose, 
  signalData, 
  cardiacMetrics,
  measurementTime,
  vitals
}: PPGSummaryDialogProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [measurementDate] = useState<Date>(new Date());
  
  useEffect(() => {
    if (!canvasRef.current || !isOpen || signalData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;
    
    // Background with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
    gradient.addColorStop(1, 'rgba(30, 41, 59, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    
    // Vertical lines every 100ms
    for (let i = 0; i < WIDTH; i += WIDTH/30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, HEIGHT);
      ctx.stroke();
    }
    
    // Horizontal lines every 100 units
    for (let i = 0; i < HEIGHT; i += HEIGHT/10) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(WIDTH, i);
      ctx.stroke();
    }

    // Calculate range of values
    const values = signalData.map(d => d.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;
    
    // Calculate time range
    const times = signalData.map(d => d.time);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times) || minTime + 30000; // Default to 30s if only one point
    const timeRange = maxTime - minTime;

    // Draw PPG signal
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Main signal path
    ctx.beginPath();
    ctx.strokeStyle = '#0EA5E9';
    
    signalData.forEach((point, index) => {
      const x = ((point.time - minTime) / timeRange) * WIDTH;
      const normalizedY = (point.value - minVal) / range;
      const y = HEIGHT - (normalizedY * HEIGHT * 0.8 + HEIGHT * 0.1);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw peaks with circles
    signalData.forEach(point => {
      if (point.isPeak) {
        const x = ((point.time - minTime) / timeRange) * WIDTH;
        const normalizedY = (point.value - minVal) / range;
        const y = HEIGHT - (normalizedY * HEIGHT * 0.8 + HEIGHT * 0.1);
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = point.isArrhythmia ? '#EF4444' : '#22C55E';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.strokeStyle = point.isArrhythmia ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)';
        ctx.stroke();
      }
    });

    // Time labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '10px "Inter", sans-serif';
    ctx.textAlign = 'center';
    
    for (let i = 0; i <= 5; i++) {
      const x = (WIDTH / 5) * i;
      const time = minTime + (timeRange / 5) * i;
      const seconds = ((time - minTime) / 1000).toFixed(1);
      ctx.fillText(`${seconds}s`, x, HEIGHT - 5);
    }

  }, [isOpen, signalData]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[90vw] bg-slate-900/90 backdrop-blur-xl border border-slate-700 text-white shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white font-sans text-xl">
            <Activity className="h-5 w-5 text-sky-400" />
            Resumen del Análisis Cardíaco
            <button 
              onClick={onClose} 
              className="ml-auto p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
          <div className="bg-slate-800/70 backdrop-blur-md rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-sky-400 font-medium mb-3 text-sm uppercase tracking-wider flex items-center">
              <Activity className="h-4 w-4 mr-1" /> 
              Cardiograma PPG
            </h3>
            <div className="bg-slate-900/60 rounded-lg overflow-hidden border border-slate-800">
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="w-full h-[180px]"
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>Total Ciclos: {signalData.filter(p => p.isPeak).length}</span>
              <span>Duración: {measurementTime}s</span>
            </div>
          </div>
          
          <div className="bg-slate-800/70 backdrop-blur-md rounded-lg p-4 border border-slate-700/50">
            <h3 className="text-sky-400 font-medium mb-3 text-sm uppercase tracking-wider flex items-center">
              <Heart className="h-4 w-4 mr-1" /> 
              Métricas Cardíacas
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
                <div className="text-xs text-slate-400">Frecuencia Cardíaca</div>
                <div className="text-xl font-medium">{formatBPM(cardiacMetrics.bpm)}</div>
              </div>
              
              <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
                <div className="text-xs text-slate-400">Concentración de O₂</div>
                <div className="text-xl font-medium">{vitals.spo2}%</div>
              </div>
              
              <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
                <div className="text-xs text-slate-400">Presión Arterial</div>
                <div className="text-xl font-medium">{vitals.pressure}</div>
              </div>
              
              <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
                <div className="text-xs text-slate-400">Arritmias</div>
                <div className="text-xl font-medium">{cardiacMetrics.arrhythmiaCount}</div>
              </div>
            </div>
            
            <h3 className="text-sky-400 font-medium mt-4 mb-2 text-sm uppercase tracking-wider flex items-center">
              <Info className="h-4 w-4 mr-1" /> 
              Análisis Detallado
            </h3>
            
            <div className="bg-slate-900/60 p-3 rounded border border-slate-800 space-y-2">
              <div className="grid grid-cols-2 text-sm">
                <span className="text-slate-400">Intervalo R-R Medio:</span>
                <span className="text-right">{formatRRInterval(cardiacMetrics.rrIntervalAvg)}</span>
              </div>
              
              <div className="grid grid-cols-2 text-sm">
                <span className="text-slate-400">Variabilidad (RMSSD):</span>
                <span className="text-right">{cardiacMetrics.rrVariability.toFixed(1)} ms</span>
              </div>
              
              <div className="grid grid-cols-2 text-sm">
                <span className="text-slate-400">Estado VFC:</span>
                <span className="text-right">{getHRVDescription(cardiacMetrics.rrVariability)}</span>
              </div>
              
              <div className="grid grid-cols-2 text-sm">
                <span className="text-slate-400">Calidad de Señal:</span>
                <span className="text-right">{getQualityDescription(cardiacMetrics.qualityScore)}</span>
              </div>
              
              <div className="grid grid-cols-2 text-sm">
                <span className="text-slate-400">Confianza:</span>
                <span className="text-right">{(cardiacMetrics.confidence * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Medición realizada el {formatDate(measurementDate)}
          </div>
          <div>
            CardioMonitor v1.0
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PPGSummaryDialog;
