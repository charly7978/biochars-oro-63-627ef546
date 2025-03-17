
import React from 'react';

interface StatusBarProps {
  signalQuality: number;
  isFingerDetected: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({
  signalQuality,
  isFingerDetected
}) => {
  return (
    <div className="px-4 py-2 flex justify-around items-center bg-black/20">
      <div className="text-white text-lg">
        Calidad: {signalQuality}
      </div>
      <div className="text-white text-lg">
        {isFingerDetected ? "Huella Detectada" : "Huella No Detectada"}
      </div>
    </div>
  );
};

export default StatusBar;
