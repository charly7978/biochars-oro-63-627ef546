
import React from 'react';
import { AlertCircle, Info } from 'lucide-react';

interface ArrhythmiaIndicatorProps {
  arrhythmiaStatus: string;
  count?: string | number;
}

const ArrhythmiaIndicator: React.FC<ArrhythmiaIndicatorProps> = ({ arrhythmiaStatus, count = "--" }) => {
  const isArrhythmiaDetected = arrhythmiaStatus.includes("DETECTED") || arrhythmiaStatus.includes("ARRHYTHMIA");
  
  return (
    <div className="flex items-center justify-center gap-2">
      {isArrhythmiaDetected ? (
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center">
            <AlertCircle className="h-5 w-5 text-red-400 animate-pulse mr-1" />
            <span className="text-red-400 font-medium">Arritmia detectada</span>
          </div>
          <div className="text-xs text-gray-300 mt-1">
            Episodios detectados: {count}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <Info className="h-4 w-4 text-green-400 mr-1" />
          <span className="text-green-400 text-sm">Ritmo regular</span>
        </div>
      )}
    </div>
  );
};

export default ArrhythmiaIndicator;
