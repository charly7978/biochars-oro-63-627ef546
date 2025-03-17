
import React from 'react';
import { Fingerprint } from 'lucide-react';

interface FingerDetectorProps {
  isFingerDetected: boolean;
  signalQuality: number;
}

const FingerDetector = ({ isFingerDetected, signalQuality }: FingerDetectorProps) => {
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
    </div>
  );
};

export default FingerDetector;
