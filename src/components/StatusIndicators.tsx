
import React from 'react';
import { ProcessedSignal } from '../types/signal';

interface StatusIndicatorsProps {
  signalQuality: number;
  lastSignal?: ProcessedSignal;
}

const StatusIndicators: React.FC<StatusIndicatorsProps> = ({ 
  signalQuality, 
  lastSignal 
}) => {
  // Mejoramos la visualización del indicador de calidad
  const qualityColorClass = signalQuality < 30 ? 'text-red-400' : 
                            signalQuality < 70 ? 'text-yellow-400' : 
                            'text-green-400';
  
  // Indicador de estado del dedo con colores
  const fingerStatusColorClass = lastSignal?.fingerDetected ? 'text-green-400' : 'text-red-400';
  
  return (
    <div className="px-4 py-2 flex justify-around items-center bg-black/20 backdrop-blur-sm">
      <div className={`text-lg font-medium ${qualityColorClass}`}>
        Calidad: {Math.round(signalQuality)}
      </div>
      <div className={`text-lg font-medium ${fingerStatusColorClass}`}>
        {lastSignal?.fingerDetected ? "Huella Detectada" : "Huella No Detectada"}
      </div>
    </div>
  );
};

export default StatusIndicators;
