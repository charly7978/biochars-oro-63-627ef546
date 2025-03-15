
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
  return (
    <div className="px-4 py-2 flex justify-around items-center bg-black/20">
      <div className="text-white text-lg">
        Calidad: {signalQuality}
      </div>
      <div className="text-white text-lg">
        {lastSignal?.fingerDetected ? "Huella Detectada" : "Huella No Detectada"}
      </div>
    </div>
  );
};

export default StatusIndicators;
