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

      // Primero consultar los dispositivos disponibles
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      console.log("Cámaras disponibles:", cameras);

      // Intentar con resolución HD estricta
      const hdConstraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { min: 1280, ideal: 1280 },
          height: { min: 720, ideal: 720 },
          frameRate: { min: 30, ideal: 30 },
          deviceId: cameras.length > 0 ? { ideal: cameras[0].deviceId } : undefined
        }
      };

      let newStream: MediaStream;
      try {
        console.log("Intentando obtener stream HD...");
        newStream = await navigator.mediaDevices.getUserMedia(hdConstraints);
      } catch (e) {
        console.log("No se pudo obtener HD, intentando resolución media:", e);
        const mediumConstraints: MediaStreamConstraints = {
          video: {
            facingMode: 'environment',
            width: { min: 640, ideal: 640 },
            height: { min: 480, ideal: 480 },
            frameRate: { min: 30, ideal: 30 },
            deviceId: cameras.length > 0 ? { ideal: cameras[0].deviceId } : undefined
          }
        };
        newStream = await navigator.mediaDevices.getUserMedia(mediumConstraints);
      }

      const videoTrack = newStream.getVideoTracks()[0];
      console.log("Capacidades de la cámara:", videoTrack.getCapabilities());
      
      // Verificar resolución inicial
      const initialSettings = videoTrack.getSettings();
      console.log("Configuración inicial:", initialSettings);

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("Intentando aplicar máxima resolución disponible...");
          
          // Forzar la resolución más alta disponible
          if (capabilities.width && capabilities.height) {
            const constraints = {
              width: { exact: Math.min(1280, capabilities.width.max || 1280) },
              height: { exact: Math.min(720, capabilities.height.max || 720) }
            };
            
            console.log("Aplicando constraints:", constraints);
            await videoTrack.applyConstraints(constraints);
          }

          // Verificar configuración después de forzar resolución
          const afterResolutionSettings = videoTrack.getSettings();
          console.log("Configuración después de forzar resolución:", afterResolutionSettings);

          // Configurar otros parámetros
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

          // Verificar configuración final
          const finalSettings = videoTrack.getSettings();
          console.log("Configuración final de la cámara:", finalSettings);

        } catch (err) {
          console.warn("Error al aplicar configuraciones:", err);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
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
