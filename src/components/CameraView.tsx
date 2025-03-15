
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
  const initializingRef = useRef<boolean>(false);
  const stabilizationTimerRef = useRef<number | null>(null);
  const videoTrackConstraintsAppliedRef = useRef<boolean>(false);

  const stopCamera = async () => {
    console.log("CameraView: Deteniendo cámara");
    streamReadyCalledRef.current = false;
    videoTrackConstraintsAppliedRef.current = false;
    
    // Limpiar cualquier temporizador pendiente
    if (stabilizationTimerRef.current) {
      clearTimeout(stabilizationTimerRef.current);
      stabilizationTimerRef.current = null;
    }
    
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
    if (initializingRef.current) {
      console.log("CameraView: Ya hay una inicialización en curso");
      return;
    }

    try {
      initializingRef.current = true;
      console.log("CameraView: Iniciando nueva stream de cámara");
      
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      await stopCamera();
      streamReadyCalledRef.current = false;

      // Esperar un momento antes de iniciar la cámara para asegurar que los recursos anteriores se liberaron
      await new Promise(resolve => setTimeout(resolve, 800));
      
      if (!mountedRef.current) {
        console.log("CameraView: El componente fue desmontado durante la inicialización");
        initializingRef.current = false;
        return;
      }
      
      // Configuración optimizada para detección de dedo
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 }, // Resolución más alta para mejor detalle de piel
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      };

      console.log("CameraView: Solicitando permiso de cámara con constraints:", constraints);
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Only proceed if component is still mounted
      if (!mountedRef.current) {
        console.log("CameraView: El componente fue desmontado después de getUserMedia");
        newStream.getTracks().forEach(track => track.stop());
        initializingRef.current = false;
        return;
      }

      if (videoRef.current) {
        console.log("CameraView: Asignando stream a elemento de video");
        videoRef.current.srcObject = newStream;
        
        await new Promise<void>((resolve) => {
          if (!videoRef.current) return resolve();
          
          const handleCanPlay = () => {
            console.log("CameraView: Video puede reproducirse ahora");
            videoRef.current?.removeEventListener('canplay', handleCanPlay);
            resolve();
          };
          
          videoRef.current.addEventListener('canplay', handleCanPlay);
          
          if (videoRef.current.readyState >= 3) {
            console.log("CameraView: Video ya está listo para reproducirse");
            videoRef.current.removeEventListener('canplay', handleCanPlay);
            resolve();
          }
        });
        
        // Configuración inmediata de la cámara para procesamiento rápido
        if (newStream.getVideoTracks().length > 0) {
          const videoTrack = newStream.getVideoTracks()[0];
          
          try {
            // Activar la linterna si está disponible
            if (videoTrack.getCapabilities()?.torch) {
              await videoTrack.applyConstraints({
                advanced: [{ torch: true }]
              }).catch(err => console.error("Error activando linterna:", err));
              console.log("Linterna activada");
            }
            
            // Configurar enfoque cercano para mejor captura de detalles
            if (videoTrack.getCapabilities()?.focusMode) {
              await videoTrack.applyConstraints({
                advanced: [{ focusMode: "continuous" }]
              }).catch(err => console.error("Error configurando enfoque:", err));
            }
            
            // Configurar exposición para maximizar detección de dedo
            if (videoTrack.getCapabilities()?.exposureMode) {
              await videoTrack.applyConstraints({
                advanced: [{ exposureMode: "continuous" }]
              }).catch(err => console.error("Error configurando exposición:", err));
            }
            
            videoTrackConstraintsAppliedRef.current = true;
          } catch (err) {
            console.error("Error aplicando configuraciones avanzadas a la cámara:", err);
          }
        }
        
        // Período de estabilización escalonado:
        // 1. Notificar rápidamente para comenzar procesamiento preliminar
        // 2. Continuar optimizando la cámara en segundo plano
        console.log("CameraView: Notificando stream inicial disponible");
        
        // Limpiar cualquier temporizador previo
        if (stabilizationTimerRef.current) {
          clearTimeout(stabilizationTimerRef.current);
        }
        
        // Respuesta rápida para iniciar procesamiento básico
        setTimeout(() => {
          if (!mountedRef.current) return;
          
          setStream(newStream);
          
          if (isMonitoring && onStreamReady && !streamReadyCalledRef.current) {
            console.log("CameraView: Notificando primera stream lista (respuesta rápida)");
            streamReadyCalledRef.current = true;
            onStreamReady(newStream);
          }
        }, 500); // Notificación rápida (500ms)
        
        // Período de estabilización completa para mejor calidad
        stabilizationTimerRef.current = window.setTimeout(() => {
          if (!mountedRef.current) {
            console.log("CameraView: El componente fue desmontado durante la estabilización");
            return;
          }
          
          // Verificar que los tracks siguen activos
          const allTracksActive = newStream.getVideoTracks().every(track => track.readyState === 'live');
          
          if (allTracksActive) {
            console.log("CameraView: Cámara estabilizada completamente");
            
            // Si ya se ha notificado anteriormente, no volver a notificar
            if (!streamReadyCalledRef.current && isMonitoring && onStreamReady) {
              console.log("CameraView: Notificando stream completamente estabilizada");
              streamReadyCalledRef.current = true;
              onStreamReady(newStream);
            }
          } else {
            console.error("CameraView: Después de estabilización, los tracks no están activos");
            // Intentar reiniciar cámara
            stopCamera();
            setTimeout(() => {
              if (mountedRef.current && isMonitoring) {
                startCamera();
              }
            }, 1000);
          }
          
          stabilizationTimerRef.current = null;
        }, 2500); // Período de estabilización más corto (2.5 segundos) para respuesta más rápida
      }
    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
    } finally {
      initializingRef.current = false;
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
      console.log("CameraView: Componente desmontado, limpiando recursos");
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
