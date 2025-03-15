
import React, { useState, useEffect } from 'react';
import CameraView from './CameraView';
import CameraProcessor from './CameraProcessor';

interface CameraHandlerProps {
  isMonitoring: boolean;
  isCameraOn: boolean;
  lastSignal?: any;
  signalQuality: number;
}

const CameraHandler: React.FC<CameraHandlerProps> = ({
  isMonitoring,
  isCameraOn,
  lastSignal,
  signalQuality,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);

  const handleStreamReady = (newStream: MediaStream) => {
    setStream(newStream);
  };

  return (
    <div className="absolute inset-0">
      <CameraView 
        onStreamReady={handleStreamReady}
        isMonitoring={isCameraOn}
        isFingerDetected={lastSignal?.fingerDetected}
        signalQuality={signalQuality}
      />
      {stream && (
        <CameraProcessor 
          isMonitoring={isMonitoring} 
          stream={stream} 
        />
      )}
    </div>
  );
};

export default CameraHandler;
