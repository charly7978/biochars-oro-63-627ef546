
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
  
  useEffect(() => {
    // Limpiar el stream cuando el componente se desmonta o cuando isCameraOn cambia a false
    return () => {
      if (stream) {
        console.log("CameraHandler: Limpiando stream al desmontar");
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const handleStreamReady = (newStream: MediaStream) => {
    console.log("CameraHandler: Stream recibido de CameraView");
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
      {stream && isMonitoring && (
        <CameraProcessor 
          isMonitoring={isMonitoring} 
          stream={stream} 
        />
      )}
    </div>
  );
};

export default CameraHandler;
