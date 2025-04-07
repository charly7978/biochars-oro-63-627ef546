
import React, { useEffect, useRef } from 'react';

interface CameraViewProps {
  onStreamReady: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
}

const CameraView: React.FC<CameraViewProps> = ({
  onStreamReady,
  isMonitoring,
  isFingerDetected = false,
  signalQuality = 0
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start or stop camera based on isMonitoring prop
  useEffect(() => {
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.error('getUserMedia is not supported in this browser');
          return;
        }

        // Try to get the preferred camera (rear-facing if available)
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: 'environment', // Try to use the rear camera first
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };

        console.log('CameraView: Requesting camera access with constraints:', constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        console.log('CameraView: Camera stream obtained');
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play().catch(err => {
                console.error('Error playing video:', err);
              });
            }
          };
        }
        
        onStreamReady(stream);
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    };

    const stopCamera = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    if (isMonitoring) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isMonitoring, onStreamReady]);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />
      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
        {!isMonitoring ? (
          <div className="text-white text-center">
            <p className="text-lg">Cámara desactivada</p>
            <p className="text-sm mt-2">Presione INICIAR para activar</p>
          </div>
        ) : !isFingerDetected ? (
          <div className="text-white text-center">
            <p className="text-lg">Coloque su dedo en la cámara</p>
            <p className="text-sm mt-2">Cubra completamente la lente</p>
          </div>
        ) : (
          <div className="text-white text-center">
            <p className="text-lg">Dedo detectado</p>
            <p className="text-sm mt-2">Calidad: {signalQuality}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraView;
