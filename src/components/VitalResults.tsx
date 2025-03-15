
import React from 'react';
import { Button } from './ui/button';

interface VitalResultsProps {
  isMonitoring: boolean;
  fingerDetected: boolean;
  signalQuality: number;
  arrhythmiaCount: number;
  lastValidResults: any;
  onStartMeasurement: () => void;
  onReset: () => void;
}

const VitalResults: React.FC<VitalResultsProps> = ({
  isMonitoring,
  fingerDetected,
  signalQuality,
  arrhythmiaCount,
  lastValidResults,
  onStartMeasurement,
  onReset,
}) => {
  return (
    <div className="w-full bg-black/60 backdrop-blur-sm rounded-xl p-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white mb-2">
          {isMonitoring 
            ? "Procesando señal PPG..." 
            : "Medición de signos vitales"}
        </h2>
        
        <p className={`text-sm ${fingerDetected ? 'text-green-400' : 'text-gray-400'}`}>
          {fingerDetected 
            ? `Dedo detectado - Calidad: ${signalQuality}%` 
            : "Coloque su dedo sobre la cámara"}
        </p>
      </div>
      
      {lastValidResults && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-800/50 p-3 rounded-lg">
            <p className="text-gray-400 text-xs">Frecuencia cardíaca</p>
            <p className="text-white text-lg font-bold">
              {lastValidResults.heartRate || "--"} <span className="text-xs">BPM</span>
            </p>
          </div>
          
          <div className="bg-gray-800/50 p-3 rounded-lg">
            <p className="text-gray-400 text-xs">SpO2</p>
            <p className="text-white text-lg font-bold">
              {lastValidResults.spo2 || "--"} <span className="text-xs">%</span>
            </p>
          </div>
          
          <div className="bg-gray-800/50 p-3 rounded-lg">
            <p className="text-gray-400 text-xs">Presión arterial</p>
            <p className="text-white text-lg font-bold">
              {lastValidResults.pressure || "--/--"} <span className="text-xs">mmHg</span>
            </p>
          </div>
          
          <div className="bg-gray-800/50 p-3 rounded-lg">
            <p className="text-gray-400 text-xs">Arritmias</p>
            <p className="text-white text-lg font-bold">
              {arrhythmiaCount} <span className="text-xs">detectadas</span>
            </p>
          </div>
        </div>
      )}
      
      <div className="flex gap-2">
        {!isMonitoring ? (
          <Button 
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={onStartMeasurement}
          >
            Iniciar Medición
          </Button>
        ) : (
          <Button 
            className="flex-1 bg-red-600 hover:bg-red-700"
            onClick={onReset}
          >
            Detener
          </Button>
        )}
      </div>
    </div>
  );
};

export default VitalResults;
