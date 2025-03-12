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

      // Intentar primero con resolución HD
      const hdConstraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { exact: 1280 },
          height: { exact: 720 },
          frameRate: { ideal: 30 }
        }
      };

      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia(hdConstraints);
      } catch (e) {
        console.log("No se pudo obtener HD, intentando resolución menor");
        const fallbackConstraints: MediaStreamConstraints = {
          video: {
            facingMode: 'environment',
            width: { exact: 640 },
            height: { exact: 480 },
            frameRate: { ideal: 30 }
          }
        };
        newStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      }

      const videoTrack = newStream.getVideoTracks()[0];
      
      // Verificar y mostrar la resolución actual
      const settings = videoTrack.getSettings();
      console.log("Resolución actual:", {
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate
      });

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          
          // Forzar la resolución más alta disponible
          if (capabilities.width && capabilities.height) {
            await videoTrack.applyConstraints({
              width: capabilities.width.max,
              height: capabilities.height.max
            });
          }

          // Configurar exposición y otros parámetros
          const settings: MediaTrackConstraintSet = {};
          
          if (capabilities.exposureMode?.includes('manual')) {
            settings.exposureMode = 'manual';
          }

          if (capabilities.focusMode?.includes('manual')) {
            settings.focusMode = 'manual';
          }

          if (capabilities.whiteBalanceMode?.includes('manual')) {
            settings.whiteBalanceMode = 'manual';
          }

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

          // Verificar configuración final después de aplicar todos los cambios
          const finalSettings = videoTrack.getSettings();
          console.log("Configuración final de la cámara:", {
            width: finalSettings.width,
            height: finalSettings.height,
            frameRate: finalSettings.frameRate
          });

        } catch (err) {
          console.warn("No se pudieron aplicar algunas optimizaciones:", err);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        // Forzar el tamaño del video
        videoRef.current.width = 1280;
        videoRef.current.height = 720;
      }

      setStream(newStream);
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
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
      width={1280}
      height={720}
      className="absolute top-0 left-0 w-auto h-auto z-0 object-cover"
      style={{
        willChange: 'transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        minWidth: '100%',
        minHeight: '100%'
      }}
    />
  );
};

export default CameraView;
