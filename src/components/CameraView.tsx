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
  signalQuality = 0,
}: CameraViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const frameIntervalRef = useRef<number>(1000 / 30); // 30 FPS
  const lastFrameTimeRef = useRef<number>(0);

  const stopCamera = async () => {
    if (stream) {
      console.log("Stopping camera stream and turning off torch");
      stream.getTracks().forEach(track => {
        // Turn off torch if it's available
        if (track.kind === 'video' && track.getCapabilities()?.torch) {
          track.applyConstraints({
            advanced: [{ torch: false }]
          }).catch(err => console.error("Error desactivando linterna:", err));
        }
        
        // Stop the track
        track.stop();
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setStream(null);
      setTorchEnabled(false);
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      const isAndroid = /android/i.test(navigator.userAgent);

      // Configuración mejorada para la cámara
      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 1280 },  // Aumentamos la resolución
        height: { ideal: 720 },  // HD
        frameRate: { ideal: 30, max: 30 }
      };

      if (isAndroid) {
        Object.assign(baseVideoConstraints, {
          resizeMode: 'crop-and-scale'
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          const settings: MediaTrackConstraintSet = {};
          
          // Configurar exposición
          if (capabilities.exposureMode?.includes('manual')) {
            settings.exposureMode = 'manual';
          } else if (capabilities.exposureMode?.includes('continuous')) {
            settings.exposureMode = 'continuous';
          }

          // Configurar enfoque
          if (capabilities.focusMode?.includes('manual')) {
            settings.focusMode = 'manual';
          } else if (capabilities.focusMode?.includes('continuous')) {
            settings.focusMode = 'continuous';
          }

          // Configurar balance de blancos
          if (capabilities.whiteBalanceMode?.includes('manual')) {
            settings.whiteBalanceMode = 'manual';
          } else if (capabilities.whiteBalanceMode?.includes('continuous')) {
            settings.whiteBalanceMode = 'continuous';
          }

          // Aplicar configuraciones
          if (Object.keys(settings).length > 0) {
            await videoTrack.applyConstraints({
              advanced: [settings]
            });
          }

          // Activar linterna si está disponible
          if (capabilities.torch) {
            console.log("Activando linterna para mejorar la señal PPG");
            await videoTrack.applyConstraints({
              advanced: [{ torch: true }]
            });
            setTorchEnabled(true);
          }

          // Optimizaciones de rendimiento para el video
          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
            videoRef.current.style.willChange = 'transform';
          }
        } catch (err) {
          console.warn("No se pudieron aplicar algunas optimizaciones:", err);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }

      setStream(newStream);
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }

      console.log("Resolución final de la cámara:", videoTrack?.getCapabilities());
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
    }
  };

  useEffect(() => {
    if (isMonitoring && !stream) {
      console.log("Starting camera because isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("Stopping camera because isMonitoring=false");
      stopCamera();
    }
    
    return () => {
      console.log("CameraView component unmounting, stopping camera");
      stopCamera();
    };
  }, [isMonitoring]);

  // Asegurar que la linterna esté encendida cuando se detecta un dedo
  useEffect(() => {
    if (stream && isFingerDetected && !torchEnabled) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.torch) {
        console.log("Activando linterna después de detectar dedo");
        videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).then(() => {
          setTorchEnabled(true);
        }).catch(err => {
          console.error("Error activando linterna:", err);
        });
      }
    }
  }, [stream, isFingerDetected, torchEnabled]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute top-0 left-0 min-w-full min-h-full w-auto h-auto z-0 object-cover"
      style={{
        willChange: 'transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden'
      }}
    />
  );
};

export default CameraView;
