
import React from 'react';
import { AlertCircle, Activity, Camera, Zap } from 'lucide-react';

interface Props {
  calibrationActive: boolean;
  feedbackActive: boolean;
  cameraFramesOK: boolean;
  optimizerRunning: boolean;
}

const SystemMicroStatus: React.FC<Props> = ({
  calibrationActive,
  feedbackActive,
  cameraFramesOK,
  optimizerRunning
}) => {
  return (
    <div className="absolute bottom-2 right-2 z-30 flex gap-1.5">
      {/* Calibration Status */}
      <div 
        className={`w-5 h-5 rounded-full flex items-center justify-center ${
          calibrationActive ? 'bg-blue-100' : 'bg-gray-100'
        }`}
        title={calibrationActive ? 'Calibración en progreso' : 'Sistema calibrado'}
      >
        <Zap 
          size={14} 
          className={calibrationActive ? 'text-blue-600 animate-pulse' : 'text-gray-400'} 
        />
      </div>

      {/* Feedback Status */}
      <div 
        className={`w-5 h-5 rounded-full flex items-center justify-center ${
          feedbackActive ? 'bg-green-100' : 'bg-gray-100'
        }`}
        title={feedbackActive ? 'Retroalimentación activa' : 'Sin retroalimentación reciente'}
      >
        <Activity 
          size={14} 
          className={feedbackActive ? 'text-green-600' : 'text-gray-400'} 
        />
      </div>

      {/* Camera Status */}
      <div 
        className={`w-5 h-5 rounded-full flex items-center justify-center ${
          cameraFramesOK ? 'bg-green-100' : 'bg-red-100'
        }`}
        title={cameraFramesOK ? 'Cámara OK' : 'Problema con cámara'}
      >
        <Camera 
          size={14} 
          className={cameraFramesOK ? 'text-green-600' : 'text-red-600'} 
        />
      </div>

      {/* Optimizer Status */}
      <div 
        className={`w-5 h-5 rounded-full flex items-center justify-center ${
          optimizerRunning ? 'bg-purple-100' : 'bg-gray-100'
        }`}
        title={optimizerRunning ? 'Optimizador activo' : 'Optimizador inactivo'}
      >
        <AlertCircle 
          size={14} 
          className={optimizerRunning ? 'text-purple-600' : 'text-gray-400'} 
        />
      </div>
    </div>
  );
};

export default SystemMicroStatus;
