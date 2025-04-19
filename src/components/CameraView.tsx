
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
  const maxRetryAttempts = 5;
  const cameraErrorCountRef = useRef<number>(0);
  const lastFocusTimeRef = useRef<number>(0);
  const processingLockRef = useRef<boolean>(false);

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
    // Evitar múltiples llamadas
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    
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
    
    processingLockRef.current = false;
  };

  const startCamera = async () => {
    // Evitar múltiples llamadas
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    
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
          frameRate: { ideal: 15, max: 30 }, // Reducido para mejor rendimiento
          width: { ideal: 960 }, // Reducido para mejor rendimiento
          height: { ideal: 540 }, // Reducido para mejor rendimiento
        });
      } else if (isIOS) {
        console.log("Configurando para iOS");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 30 }, // Reducido para mejor rendimiento
          width: { ideal: 1280 },
          height: { ideal: 720 },
        });
      } else {
        console.log("Configurando para dispositivo general");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 20, max: 30 }, // Reducido para mejor rendimiento
          width: { ideal: 1280 },
          height: { ideal: 720 },
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
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Activar linterna (independiente de la plataforma)
          if (capabilities.torch) {
            console.log("Activando linterna");
            try {
              await videoTrack.applyConstraints({
                advanced: [{ torch: true }]
              });
              setTorchEnabled(true);
            } catch (err) {
              console.error("Error al activar linterna:", err);
              // No mostrar toast para no sobrecargar al usuario
            }
          } else {
            console.log("La linterna no está disponible en este dispositivo");
          }
          
          // Configuraciones de enfoque (no aplicar todo a la vez)
          let appliedChanges = false;
          
          if (capabilities.focusMode && !isAndroid) {
            try {
              await videoTrack.applyConstraints({
                advanced: [{ focusMode: 'continuous' }]
              });
              appliedChanges = true;
              console.log("Modo de enfoque configurado a continuo");
            } catch (err) {
              console.error("Error al configurar enfoque:", err);
            }
          }
          
          // Si se aplicaron cambios, esperar un poco
          if (appliedChanges) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // Aplicar sólo algunas optimizaciones críticas más
          try {
            const criticalConstraints = [];
            
            if (capabilities.exposureMode) {
              criticalConstraints.push({ exposureMode: 'continuous' });
            }
            
            if (criticalConstraints.length > 0) {
              await videoTrack.applyConstraints({
                advanced: criticalConstraints
              });
              console.log("Aplicadas configuraciones críticas de exposición");
            }
          } catch (err) {
            console.error("Error al aplicar configuraciones críticas:", err);
          }
          
          // Optimizaciones de rendimiento para el elemento de video
          if (videoRef.current) {
            videoRef.current.style.willChange = 'transform';
            videoRef.current.style.backfaceVisibility = 'hidden';
            videoRef.current.style.transform = 'translateZ(0)';
          }
          
        } catch (err) {
          console.log("Error al aplicar optimizaciones:", err);
        }
      }

      // Configurar el elemento de video
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        
        // Optimizaciones para rendimiento
        videoRef.current.style.willChange = 'transform';
        videoRef.current.style.transform = 'translateZ(0)';
        videoRef.current.style.imageRendering = 'auto'; // Cambiado para mejor rendimiento
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
          processingLockRef.current = false; // Desbloquear para permitir nuevo intento
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
    } finally {
      processingLockRef.current = false;
    }
  };

  // Función para refrescar el auto-enfoque (optimizada)
  const refreshAutoFocus = useCallback(async () => {
    const now = Date.now();
    // Limitar frecuencia de refresco a una vez cada 5 segundos
    if ((now - lastFocusTimeRef.current) < 5000 || !stream || isFocusing || isAndroid) {
      return;
    }
    
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack && videoTrack.getCapabilities()?.focusMode) {
      try {
        setIsFocusing(true);
        lastFocusTimeRef.current = now;
        
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
    
    // Refrescar enfoque cuando se detecta dedo (pero menos frecuentemente para ahorrar recursos)
    if (isFingerDetected && !isAndroid) {
      refreshAutoFocus();
      
      // Programar refrescos periódicos pero menos frecuentes (cada 5 segundos)
      const focusInterval = setInterval(refreshAutoFocus, 5000);
      return () => clearInterval(focusInterval);
    }
  }, [stream, isFingerDetected, torchEnabled, refreshAutoFocus, isAndroid]);

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
          backfaceVisibility: 'hidden'
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
