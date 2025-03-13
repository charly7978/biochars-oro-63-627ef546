
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
  const [isFocusing, setIsFocusing] = useState(false);
  const frameIntervalRef = useRef<number>(1000 / 30); // 30 FPS
  const lastFrameTimeRef = useRef<number>(0);
  // Nuevas referencias para manejo mejorado de la cámara
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 3;

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
      retryAttemptsRef.current = 0;
    }
  };

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      // Configuración de video optimizada para captura de PPG
      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 640 }, // Resolución reducida para mejor rendimiento
        height: { ideal: 480 }
      };

      // Mejoras específicas para diferentes plataformas
      if (isAndroid) {
        // Ajustes para mejorar la extracción de señal en Android
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 30 },
          resizeMode: 'crop-and-scale'
        });
      } else if (isIOS) {
        // Configuraciones específicas para iOS
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 30 }
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints
      };

      console.log("Intentando acceder a la cámara con configuración:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Cámara inicializada correctamente");
      
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("Capacidades de la cámara:", capabilities);
          
          const advancedConstraints: MediaTrackConstraintSet[] = [];
          
          if (capabilities.exposureMode) {
            advancedConstraints.push({ 
              exposureMode: 'continuous',
              // Aumentar exposición si está disponible para mejorar la señal
              exposureCompensation: capabilities.exposureCompensation?.max || 0
            });
          }
          
          if (capabilities.focusMode) {
            advancedConstraints.push({ focusMode: 'continuous' });
          }
          
          if (capabilities.whiteBalanceMode) {
            advancedConstraints.push({ whiteBalanceMode: 'continuous' });
          }
          
          // Intentar aumentar el brillo/contraste si está disponible
          if (capabilities.brightness) {
            const maxBrightness = capabilities.brightness.max || 0;
            advancedConstraints.push({ brightness: maxBrightness * 0.7 }); // 70% del máximo
          }
          
          if (capabilities.contrast) {
            const maxContrast = capabilities.contrast.max || 0;
            advancedConstraints.push({ contrast: maxContrast * 0.6 }); // 60% del máximo
          }

          if (advancedConstraints.length > 0) {
            console.log("Aplicando configuraciones avanzadas:", advancedConstraints);
            await videoTrack.applyConstraints({
              advanced: advancedConstraints
            });
          }

          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
          }
          
          // Activar linterna (flash) inmediatamente si está disponible
          if (capabilities.torch) {
            console.log("Activando linterna para mejorar la señal PPG");
            await videoTrack.applyConstraints({
              advanced: [{ torch: true }]
            });
            setTorchEnabled(true);
          } else {
            console.log("La linterna no está disponible en este dispositivo");
          }
        } catch (err) {
          console.log("No se pudieron aplicar algunas optimizaciones:", err);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        
        // Aplicar optimizaciones de rendimiento
        if (isAndroid || isIOS) {
          videoRef.current.style.willChange = 'transform';
          videoRef.current.style.transform = 'translateZ(0)';
        }
      }

      setStream(newStream);
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      // Reiniciar contador de intentos
      retryAttemptsRef.current = 0;
      
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      
      // Incrementar contador de intentos y reintentar si no excede el máximo
      retryAttemptsRef.current++;
      if (retryAttemptsRef.current <= maxRetryAttempts) {
        console.log(`Reintentando iniciar cámara (intento ${retryAttemptsRef.current} de ${maxRetryAttempts})...`);
        setTimeout(startCamera, 1000); // Reintento con delay
      } else {
        console.error(`Se alcanzó el máximo de ${maxRetryAttempts} intentos sin éxito`);
      }
    }
  };
  
  // Función para refrescar el auto-enfoque periódicamente
  const refreshAutoFocus = useCallback(async () => {
    if (stream && !isFocusing) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.focusMode) {
        try {
          setIsFocusing(true);
          // Cambiar brevemente a enfoque manual y volver a auto para refrescar
          await videoTrack.applyConstraints({
            advanced: [{ focusMode: 'manual' }]
          });
          
          // Pequeña pausa para permitir que el cambio surta efecto
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Volver a enfoque automático
          await videoTrack.applyConstraints({
            advanced: [{ focusMode: 'continuous' }]
          });
          
          console.log("Auto-enfoque refrescado con éxito");
        } catch (err) {
          console.error("Error al refrescar auto-enfoque:", err);
        } finally {
          setIsFocusing(false);
        }
      }
    }
  }, [stream, isFocusing]);

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
    
    // Refrescar el enfoque periódicamente cuando hay un dedo detectado
    // para mantener la imagen nítida
    if (isFingerDetected) {
      const focusInterval = setInterval(refreshAutoFocus, 5000); // Cada 5 segundos
      return () => clearInterval(focusInterval);
    }
  }, [stream, isFingerDetected, torchEnabled, refreshAutoFocus]);

  // Mejorar rendimiento optimizando la tasa de captura
  const targetFrameInterval = signalQuality > 70 ? 1000/30 : 1000/15; // Adaptativo según calidad

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
