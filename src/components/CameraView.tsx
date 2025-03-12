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
      const isIOS = /ipad|iphone|ipod/i.test(navigator.userAgent);

      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 1280 },  // Mayor resolución para mejor detalle
        height: { ideal: 720 }
      };

      if (isAndroid) {
        // Ajustes para mejorar la extracción de señal en Android
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 30 }, // Mantener 30 FPS estables
          // En algunos Android, estos ajustes pueden mejorar la señal PPG
          exposureMode: "manual",
          focusMode: "continuous"
        });
      } else if (isIOS) {
        // Ajustes específicos para iOS
        Object.assign(baseVideoConstraints, {
          frameRate: { min: 25, ideal: 30 }, // iOS funciona mejor con framerates altos
        });
      }

      // Solicitar acceso a la cámara con las restricciones configuradas
      const stream = await navigator.mediaDevices.getUserMedia({
        video: baseVideoConstraints,
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStream(stream);

      if (onStreamReady) {
        onStreamReady(stream);
      }

      // Activar la linterna automáticamente para mejorar la señal
      setTimeout(() => enableTorch(true), 500);

      console.log("Cámara iniciada con configuración optimizada para PPG");
    } catch (error) {
      console.error("Error al iniciar la cámara:", error);
    }
  };

  const enableTorch = async (enable: boolean) => {
    if (!stream) return;

    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return;

    try {
      const track = videoTracks[0];
      if (!track.getCapabilities().torch) {
        console.log("Este dispositivo no soporta el control de linterna");
        return;
      }

      // Aplicar modo de linterna
      await track.applyConstraints({
        advanced: [{ torch: enable }]
      });

      // Si estamos activando la linterna, también optimizamos otros parámetros
      if (enable) {
        // Intentar aplicar configuraciones adicionales que pueden mejorar la señal
        try {
          // Algunos dispositivos soportan estos parámetros adicionales
          await track.applyConstraints({
            advanced: [{ 
              exposureMode: "manual",       // Exposición manual
              exposureTime: 2000,           // Tiempo de exposición moderado (microsegundos)
              whiteBalanceMode: "manual",   // Balance de blancos manual
              colorTemperature: 3300        // Temperatura de color cálida (favorece rojos)
            }]
          });
        } catch (err) {
          // Estos parámetros son opcionales, así que ignoramos errores
          console.log("Parámetros avanzados de cámara no soportados");
        }
      }

      setTorchEnabled(enable);
      console.log(`Linterna ${enable ? 'activada' : 'desactivada'}`);
    } catch (err) {
      console.error("Error al controlar la linterna:", err);
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

  // Cambiar la tasa de cuadros a, por ejemplo, 12 FPS:
  const targetFrameInterval = 1000/12; // Apunta a 12 FPS para menor consumo

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
