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
  const [isWindows, setIsWindows] = useState(false);
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 3;

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const androidDetected = /android/i.test(userAgent);
    const windowsDetected = /windows nt/i.test(userAgent);
    
    console.log("Plataforma detectada:", {
      userAgent,
      isAndroid: androidDetected,
      isWindows: windowsDetected,
      isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    });
    
    setIsAndroid(androidDetected);
    setIsWindows(windowsDetected);
  }, []);

  const stopCamera = async () => {
    if (stream) {
      console.log("Stopping camera stream and turning off torch");
      stream.getTracks().forEach(track => {
        try {
          if (track.kind === 'video' && track.getCapabilities()?.torch) {
            track.applyConstraints({
              advanced: [{ torch: false }]
            }).catch(err => console.error("Error desactivando linterna:", err));
          }
          
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
      const isWindows = /windows nt/i.test(navigator.userAgent);

      // Usar resoluciones más bajas para mejorar el rendimiento y la sensibilidad
      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 640 },  // Resolución reducida para mejor rendimiento
        height: { ideal: 480 }, // y más sensibilidad en la captura de luz
        frameRate: { ideal: 30, min: 15 }  // Priorizar frames por segundo
      };

      if (isAndroid) {
        console.log("Configurando para Android con prioridad en sensibilidad");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 15 },
          width: { ideal: 640 },
          height: { ideal: 480 }
        });
      } else if (isIOS) {
        console.log("Configurando para iOS con prioridad en sensibilidad");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 15 },
          width: { ideal: 640 },
          height: { ideal: 480 }
        });
      } else if (isWindows) {
        console.log("Configurando para Windows con prioridad en sensibilidad");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 15 },
          width: { ideal: 640 },
          height: { ideal: 480 }
        });
      } else {
        console.log("Configurando para escritorio con prioridad en sensibilidad");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, min: 15 },
          width: { ideal: 640 },
          height: { ideal: 480 }
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("Intentando acceder a la cámara con configuración para máxima sensibilidad:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Cámara inicializada correctamente para máxima sensibilidad");
      
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("Capacidades de la cámara:", capabilities);
          
          // Activar la linterna inmediatamente es crítico para la detección
          if (capabilities.torch) {
            console.log("Activando linterna inmediatamente");
            try {
              await videoTrack.applyConstraints({
                advanced: [{ torch: true }]
              });
              setTorchEnabled(true);
              console.log("Linterna activada con éxito");
            } catch (err) {
              console.error("Error al activar linterna:", err);
              // Intentamos de nuevo
              setTimeout(async () => {
                try {
                  await videoTrack.applyConstraints({
                    advanced: [{ torch: true }]
                  });
                  setTorchEnabled(true);
                  console.log("Linterna activada con éxito en segundo intento");
                } catch (err) {
                  console.error("Error al activar linterna en segundo intento:", err);
                }
              }, 1000);
            }
          } else {
            console.log("ADVERTENCIA: La linterna no está disponible en este dispositivo");
          }
          
          // Aplicar configuraciones agresivas para maximizar brillo/exposición
          const advancedConstraints: MediaTrackConstraintSet[] = [];
          
          if (capabilities.exposureMode) {
            advancedConstraints.push({ 
              exposureMode: 'manual'
            });
            
            if (capabilities.exposureCompensation?.max) {
              advancedConstraints.push({
                exposureCompensation: capabilities.exposureCompensation.max
              });
            }
          }
          
          if (capabilities.brightness && capabilities.brightness.max) {
            advancedConstraints.push({ 
              brightness: capabilities.brightness.max
            });
          }
          
          if (capabilities.contrast && capabilities.contrast.max) {
            advancedConstraints.push({ 
              contrast: capabilities.contrast.max * 0.9
            });
          }

          if (advancedConstraints.length > 0) {
            console.log("Aplicando configuraciones agresivas para máxima sensibilidad:", advancedConstraints);
            for (const constraint of advancedConstraints) {
              try {
                await videoTrack.applyConstraints({
                  advanced: [constraint]
                });
              } catch (err) {
                console.warn("No se pudo aplicar configuración:", constraint, err);
              }
            }
          }
          
        } catch (err) {
          console.log("No se pudieron aplicar algunas optimizaciones:", err);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        
        // Optimizaciones para rendimiento de video
        videoRef.current.style.willChange = 'transform';
        videoRef.current.style.transform = 'translateZ(0)';
        videoRef.current.style.imageRendering = 'crisp-edges';
        videoRef.current.style.backfaceVisibility = 'hidden';
        videoRef.current.style.perspective = '1000px';
      }

      setStream(newStream);
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      retryAttemptsRef.current = 0;
      
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      
      retryAttemptsRef.current++;
      if (retryAttemptsRef.current <= maxRetryAttempts) {
        console.log(`Reintentando iniciar cámara (intento ${retryAttemptsRef.current} de ${maxRetryAttempts})...`);
        setTimeout(startCamera, 1000);
      } else {
        console.error(`Se alcanzó el máximo de ${maxRetryAttempts} intentos sin éxito`);
      }
    }
  };

  const refreshAutoFocus = useCallback(async () => {
    if (stream && !isFocusing && !isAndroid) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.focusMode) {
        try {
          setIsFocusing(true);
          await videoTrack.applyConstraints({
            advanced: [{ focusMode: 'manual' }]
          });
          await new Promise(resolve => setTimeout(resolve, 100));
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
    
    if (isFingerDetected && !isAndroid) {
      const focusInterval = setInterval(refreshAutoFocus, 5000);
      return () => clearInterval(focusInterval);
    }
  }, [stream, isFingerDetected, torchEnabled, refreshAutoFocus, isAndroid]);

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
        backfaceVisibility: 'hidden',
        imageRendering: 'crisp-edges'
      }}
    />
  );
};

export default CameraView;
