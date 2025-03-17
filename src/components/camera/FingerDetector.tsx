
import React from 'react';
import { Fingerprint } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface FingerDetectorProps {
  isFingerDetected: boolean;
  signalQuality: number;
  calibrationProgress?: number;
  isCalibrating?: boolean;
  arrhythmiaCalibrationProgress?: number;
  isArrhythmiaCalibrating?: boolean;
}

const FingerDetector = ({ 
  isFingerDetected, 
  signalQuality, 
  calibrationProgress = 0,
  isCalibrating = false,
  arrhythmiaCalibrationProgress = 0,
  isArrhythmiaCalibrating = false
}: FingerDetectorProps) => {
  // Ensure progress is always a valid number and at least 1 if calibrating
  const validCalibrationProgress = isNaN(calibrationProgress) ? 0 : 
    isCalibrating && calibrationProgress <= 0 ? 1 : Math.max(0, Math.min(100, calibrationProgress));
  const validArrhythmiaProgress = isNaN(arrhythmiaCalibrationProgress) ? 0 : Math.max(0, Math.min(100, arrhythmiaCalibrationProgress));
  
  return (
    <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center">
      <Fingerprint
        size={48}
        className={`transition-colors duration-300 ${
          !isFingerDetected ? 'text-gray-400' :
          signalQuality > 75 ? 'text-green-500' :
          signalQuality > 50 ? 'text-yellow-500' :
          'text-red-500'
        }`}
      />
      <span className={`text-xs mt-2 transition-colors duration-300 ${
        isFingerDetected ? 'text-green-500' : 'text-gray-400'
      }`}>
        {isFingerDetected ? "dedo detectado" : "ubique su dedo en el lente"}
      </span>
      
      {isCalibrating && (
        <div className="mt-2 w-32">
          <Progress value={validCalibrationProgress} className="h-1.5" />
          <span className="text-xs text-center block mt-1 text-white">
            {Math.round(validCalibrationProgress)}% calibrado
          </span>
        </div>
      )}
      
      {isArrhythmiaCalibrating && isFingerDetected && !isCalibrating && (
        <div className="mt-2 w-32">
          <Progress value={validArrhythmiaProgress} className="h-1.5 bg-yellow-300/20" />
          <span className="text-xs text-center block mt-1 text-yellow-200">
            {Math.round(validArrhythmiaProgress)}% calibrando arritmias
          </span>
        </div>
      )}
    </div>
  );
};

export default FingerDetector;
