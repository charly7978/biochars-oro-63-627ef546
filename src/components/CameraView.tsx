
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

  const stopCamera = async () => {
    console.log("CameraView: Deteniendo cámara");
    streamReadyCalledRef.current = false;
    
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
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!mountedRef.current) {
        console.log("CameraView: El componente fue desmontado durante la inicialización");
        initializingRef.current = false;
        return;
      }
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
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
        
        // Período de estabilización de la cámara
        console.log("CameraView: Esperando período de estabilización de cámara");
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (!mountedRef.current) {
          console.log("CameraView: El componente fue desmontado durante la estabilización");
          newStream.getTracks().forEach(track => track.stop());
          initializingRef.current = false;
          return;
        }

        setStream(newStream);
        
        // Verificar que los tracks todavía están activos
        const allTracksActive = newStream.getVideoTracks().every(track => track.readyState === 'live');
        
        if (allTracksActive && isMonitoring && onStreamReady && !streamReadyCalledRef.current) {
          console.log("CameraView: Todos los tracks activos, notificando stream lista para procesamiento");
          streamReadyCalledRef.current = true;
          onStreamReady(newStream);
        } else {
          console.log("CameraView: Condiciones para notificar stream no cumplidas:", {
            allTracksActive,
            isMonitoring,
            hasCallback: !!onStreamReady,
            alreadyCalled: streamReadyCalledRef.current
          });
        }
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
