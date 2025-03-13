
import React, { useRef, useEffect, useState, useCallback } from 'react';

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
  const [isAndroid, setIsAndroid] = useState(false);
  // Nuevas referencias para manejo mejorado de la cámara
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 3;

  // Detector de plataforma
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const androidDetected = /android/i.test(userAgent);
    console.log("Plataforma detectada:", {
      userAgent,
      isAndroid: androidDetected,
      isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    });
    setIsAndroid(androidDetected);
  }, []);

  const stopCamera = async () => {
    if (stream) {
      console.log("Stopping camera stream and turning off torch");
      stream.getTracks().forEach(track => {
        try {
          // Turn off torch if it's available
          if (track.kind === 'video' && track.getCapabilities()?.torch) {
            track.applyConstraints({
              advanced: [{ torch: false }]
            }).catch(err => console.error("Error desactivando linterna:", err));
          }
          
          // Stop the track
          track.stop();
        } catch (err) {
          console.error("Error al detener track:", err);
        }
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

      // Configuración base de video para todas las plataformas
      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 640 }, 
        height: { ideal: 480 }
      };

      // Configuraciones específicas para diferentes plataformas
      if (isAndroid) {
        console.log("Configurando para Android");
        Object.assign(baseVideoConstraints, {
          // Reducir framerate para Android para mayor estabilidad
          frameRate: { ideal: 15, max: 30 },
          
          // Reducir resolución para Android
          width: { ideal: 320 },
          height: { ideal: 240 }
        });
      } else if (isIOS) {
        console.log("Configurando para iOS");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 20, max: 30 }
        });
      } else {
        console.log("Configurando para escritorio");
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("Intentando acceder a la cámara con configuración:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Cámara inicializada correctamente");
      
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("Capacidades de la cámara:", capabilities);
          
          // Esperar a que el track esté listo antes de configurar
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const advancedConstraints: MediaTrackConstraintSet[] = [];
          
          // En Android priorizar estabilidad sobre calidad
          if (isAndroid) {
            // Configuración simplificada para Android
            try {
              if (capabilities.torch) {
                console.log("Activando linterna en Android");
                await videoTrack.applyConstraints({
                  advanced: [{ torch: true }]
                });
                setTorchEnabled(true);
              }
            } catch (err) {
              console.error("Error al activar linterna en Android:", err);
            }
          } else {
            // Configuración completa para otras plataformas
            if (capabilities.exposureMode) {
              const exposureConstraint: MediaTrackConstraintSet = { 
                exposureMode: 'continuous' 
              };
              
              if (capabilities.exposureCompensation?.max) {
                exposureConstraint.exposureCompensation = capabilities.exposureCompensation.max;
              }
              
              advancedConstraints.push(exposureConstraint);
            }
            
            if (capabilities.focusMode) {
              advancedConstraints.push({ focusMode: 'continuous' });
            }
            
            if (capabilities.whiteBalanceMode) {
              advancedConstraints.push({ whiteBalanceMode: 'continuous' });
            }
            
            if (capabilities.brightness && capabilities.brightness.max) {
              const maxBrightness = capabilities.brightness.max;
              advancedConstraints.push({ brightness: maxBrightness * 0.7 });
            }
            
            if (capabilities.contrast && capabilities.contrast.max) {
              const maxContrast = capabilities.contrast.max;
              advancedConstraints.push({ contrast: maxContrast * 0.6 });
            }

            if (advancedConstraints.length > 0) {
              console.log("Aplicando configuraciones avanzadas:", advancedConstraints);
              await videoTrack.applyConstraints({
                advanced: advancedConstraints
              });
            }

            // Activar linterna para no-Android
            if (capabilities.torch) {
              console.log("Activando linterna para mejorar la señal PPG");
              await videoTrack.applyConstraints({
                advanced: [{ torch: true }]
              });
              setTorchEnabled(true);
            } else {
              console.log("La linterna no está disponible en este dispositivo");
            }
          }
          
          // Aplicar optimizaciones de renderizado para todos
          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
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
    if (stream && !isFocusing && !isAndroid) { // Evitar en Android
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
  }, [stream, isFocusing, isAndroid]);

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
    // pero solo en plataformas no-Android
    if (isFingerDetected && !isAndroid) {
      const focusInterval = setInterval(refreshAutoFocus, 5000); // Cada 5 segundos
      return () => clearInterval(focusInterval);
    }
  }, [stream, isFingerDetected, torchEnabled, refreshAutoFocus, isAndroid]);

  // En Android usamos framerates más bajos para estabilidad
  const targetFrameInterval = isAndroid ? 1000/10 : 
                             signalQuality > 70 ? 1000/30 : 1000/15;

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
