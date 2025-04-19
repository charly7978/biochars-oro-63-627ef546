
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { toast } from "@/hooks/use-toast";

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
  const [isIOS, setIsIOS] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 5; // Aumentado para más intentos
  const cameraErrorCountRef = useRef<number>(0);

  // Detección mejorada de plataforma
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const androidDetected = /android/i.test(userAgent);
    const iOSDetected = /iphone|ipad|ipod/i.test(userAgent);
    const windowsDetected = /windows nt/i.test(userAgent);
    
    console.log("Plataforma detectada:", {
      userAgent,
      isAndroid: androidDetected,
      isIOS: iOSDetected,
      isWindows: windowsDetected,
      isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    });
    
    setIsAndroid(androidDetected);
    setIsIOS(iOSDetected);
    setIsWindows(windowsDetected);
  }, []);

  const stopCamera = async () => {
    if (stream) {
      console.log("Deteniendo flujo de cámara y apagando linterna");
      
      try {
        // Intentar apagar la linterna antes de detener los tracks
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && videoTrack.getCapabilities()?.torch) {
          await videoTrack.applyConstraints({
            advanced: [{ torch: false }]
          }).catch(err => console.error("Error desactivando linterna:", err));
        }
      } catch (err) {
        console.error("Error al intentar apagar la linterna:", err);
      }
      
      // Detener todos los tracks
      stream.getTracks().forEach(track => {
        try {
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
        toast({
          title: "Error de cámara",
          description: "Tu navegador no soporta acceso a la cámara",
          variant: "destructive",
        });
        throw new Error("getUserMedia no está soportado");
      }

      // Configuraciones específicas por plataforma
      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      if (isAndroid) {
        console.log("Configurando para Android");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        });
      } else if (isIOS) {
        console.log("Configurando para iOS");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        });
      } else if (isWindows) {
        console.log("Configurando para Windows");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        });
      } else {
        console.log("Configurando para escritorio con máxima resolución");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        });
      }

      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };

      console.log("Intentando acceder a la cámara con configuración:", JSON.stringify(constraints));
      
      // Intentar obtener acceso a la cámara con timeout para evitar bloqueos
      const cameraAccessPromise = navigator.mediaDevices.getUserMedia(constraints);
      
      const timeoutPromise = new Promise<MediaStream>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout al acceder a la cámara")), 10000);
      });
      
      const newStream = await Promise.race([cameraAccessPromise, timeoutPromise]);
      
      console.log("Cámara inicializada correctamente");
      
      // Obtener el track de video
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          // Recopilar capacidades de la cámara
          const capabilities = videoTrack.getCapabilities();
          console.log("Capacidades de la cámara:", capabilities);
          
          // Dar tiempo para que la cámara inicialice
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Array para restricciones avanzadas
          const advancedConstraints: MediaTrackConstraintSet[] = [];
          
          if (isAndroid) {
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
              toast({
                title: "Atención",
                description: "No se pudo activar la linterna. Las mediciones pueden ser menos precisas.",
                duration: 3000,
              });
            }
          } else {
            // Configuraciones avanzadas para otras plataformas
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
              advancedConstraints.push({ brightness: maxBrightness * 0.2 });
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

            if (capabilities.torch) {
              console.log("Activando linterna para mejorar la señal PPG");
              await videoTrack.applyConstraints({
                advanced: [{ torch: true }]
              });
              setTorchEnabled(true);
            } else {
              console.log("La linterna no está disponible en este dispositivo");
              toast({
                title: "Aviso",
                description: "Tu dispositivo no tiene linterna. Las mediciones serán menos precisas.",
                duration: 3000,
              });
            }
          }
          
          // Optimizaciones de rendimiento para el elemento de video
          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
            videoRef.current.style.willChange = 'transform';
            videoRef.current.style.imageRendering = 'crisp-edges';
          }
          
        } catch (err) {
          console.log("No se pudieron aplicar algunas optimizaciones:", err);
        }
      }

      // Configurar el elemento de video
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        
        // Optimizaciones para rendimiento
        videoRef.current.style.willChange = 'transform';
        videoRef.current.style.transform = 'translateZ(0)';
        videoRef.current.style.imageRendering = 'crisp-edges';
        videoRef.current.style.backfaceVisibility = 'hidden';
        videoRef.current.style.perspective = '1000px';
      }

      // Guardar la referencia al stream
      setStream(newStream);
      
      // Notificar al componente padre
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      // Reiniciar contadores
      retryAttemptsRef.current = 0;
      cameraErrorCountRef.current = 0;
      
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      cameraErrorCountRef.current++;
      
      // Mostrar notificación solo en errores repetidos
      if (cameraErrorCountRef.current > 1) {
        toast({
          title: "Error de cámara",
          description: "No se pudo acceder a la cámara. Verifica los permisos.",
          variant: "destructive",
        });
      }
      
      // Reintentar con configuración reducida
      if (retryAttemptsRef.current <= maxRetryAttempts) {
        console.log(`Reintentando iniciar cámara con configuración reducida (intento ${retryAttemptsRef.current} de ${maxRetryAttempts})...`);
        retryAttemptsRef.current++;
        
        // Esperar antes de reintentar
        setTimeout(() => {
          // En reintento, usar configuración más básica
          if (retryAttemptsRef.current > 2) {
            console.log("Usando configuración básica para reintento");
          }
          startCamera();
        }, 1000);
      } else {
        console.error(`Se alcanzó el máximo de ${maxRetryAttempts} intentos sin éxito`);
        toast({
          title: "Error persistente",
          description: "No se pudo iniciar la cámara después de varios intentos. Intenta recargar la página.",
          variant: "destructive",
          duration: 5000,
        });
      }
    }
  };

  // Función para refrescar el auto-enfoque
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

  // Iniciar/detener cámara según el estado de monitoreo
  useEffect(() => {
    if (isMonitoring && !stream) {
      console.log("Iniciando cámara porque isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("Deteniendo cámara porque isMonitoring=false");
      stopCamera();
    }
    
    return () => {
      console.log("CameraView desmontándose, deteniendo cámara");
      stopCamera();
    };
  }, [isMonitoring, stream]);

  // Gestión de linterna y enfoque basado en detección de dedo
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
    
    // Refrescar enfoque cuando se detecta dedo
    if (isFingerDetected && !isAndroid) {
      refreshAutoFocus();
      
      // Programar refrescos periódicos de enfoque
      const focusInterval = setInterval(refreshAutoFocus, 5000);
      return () => clearInterval(focusInterval);
    }
  }, [stream, isFingerDetected, torchEnabled, refreshAutoFocus, isAndroid]);

  // Ajustar la tasa de muestreo según la calidad de la señal y plataforma
  const targetFrameInterval = isAndroid ? 1000/15 : 
                             signalQuality > 70 ? 1000/30 : 1000/20;

  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center">
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
      
      {/* Indicador visual para colocar el dedo */}
      {isMonitoring && !isFingerDetected && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-32 h-32 rounded-full border-4 border-white border-opacity-70 flex items-center justify-center animate-pulse">
            <div className="text-white text-center font-bold">
              Coloque su dedo aquí
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraView;
