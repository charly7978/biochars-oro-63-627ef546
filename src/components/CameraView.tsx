
import React, { useRef, useEffect, useState } from 'react';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
}

const CameraView = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false,
  signalQuality = 0 
}: CameraViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamReadyCalledRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  const stopCamera = async () => {
    console.log("CameraView: Deteniendo cámara");
    streamReadyCalledRef.current = false;
    
    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          console.error("Error stopping track:", err);
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      await stopCamera();
      streamReadyCalledRef.current = false;

      console.log("CameraView: Iniciando nueva stream de cámara");
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Only proceed if component is still mounted
      if (!mountedRef.current) {
        newStream.getTracks().forEach(track => track.stop());
        return;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        
        await new Promise<void>((resolve) => {
          if (!videoRef.current) return resolve();
          
          const handleCanPlay = () => {
            videoRef.current?.removeEventListener('canplay', handleCanPlay);
            resolve();
          };
          
          videoRef.current.addEventListener('canplay', handleCanPlay);
          
          if (videoRef.current.readyState >= 3) {
            videoRef.current.removeEventListener('canplay', handleCanPlay);
            resolve();
          }
        });
        
        // Additional stabilization wait
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!mountedRef.current) {
          newStream.getTracks().forEach(track => track.stop());
          return;
        }

        setStream(newStream);
        
        if (isMonitoring && onStreamReady && !streamReadyCalledRef.current) {
          console.log("CameraView: Notificando stream lista para procesamiento");
          streamReadyCalledRef.current = true;
          onStreamReady(newStream);
        }
      }
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
    }
  };

  useEffect(() => {
    console.log("CameraView: isMonitoring cambiado a", isMonitoring);
    mountedRef.current = true;
    
    if (isMonitoring) {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [isMonitoring]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute top-0 left-0 min-w-full min-h-full w-auto h-auto z-0 object-cover"
    />
  );
};

export default CameraView;
