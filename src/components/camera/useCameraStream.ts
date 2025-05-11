
import { useState, useRef, useCallback } from 'react';
import { getDeviceSpecificConstraints } from './CameraUtils';

interface UseCameraStreamProps {
  onStreamReady?: (stream: MediaStream) => void;
  isMonitoring: boolean;
}

export const useCameraStream = ({ onStreamReady, isMonitoring }: UseCameraStreamProps) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isFocusing, setIsFocusing] = useState(false);
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 3;
  
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
      
      setStream(null);
      setTorchEnabled(false);
      retryAttemptsRef.current = 0;
    }
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.error("CameraView: navigator.mediaDevices.getUserMedia no está soportado en este navegador.");
      return;
    }

    if (!window.isSecureContext) {
      console.error("CameraView: No se puede acceder a la cámara. El contexto no es seguro (se requiere HTTPS o localhost).");
      return;
    }

    try {
      const constraints = getDeviceSpecificConstraints();
      
      console.log("Intentando acceder a la cámara con configuración:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Cámara inicializada correctamente");
      
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("Capacidades de la cámara:", capabilities);
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
          await applyCameraOptimizations(videoTrack, capabilities);
          
        } catch (err) {
          console.warn("No se pudieron aplicar algunas optimizaciones a la cámara:", err);
        }
      }

      setStream(newStream);
      
      if (onStreamReady) {
        onStreamReady(newStream);
      }
      
      retryAttemptsRef.current = 0;
      
    } catch (err: any) {
      console.error("Error detallado al iniciar la cámara:", {
        message: err.message,
        name: err.name,
        stack: err.stack,
        errorObject: err
      });
      
      if (err instanceof TypeError || 
          err.name === 'NotAllowedError' || 
          err.name === 'SecurityError' ||
          err.message === 'getUserMedia no está soportado' ||
          !window.isSecureContext
         ) {
        console.error(`CameraView: Error fundamental de permisos o API. No se reintentará. Causa: ${err.name} - ${err.message}`);
        retryAttemptsRef.current = maxRetryAttempts + 1;
      } else {
        retryAttemptsRef.current++;
        if (retryAttemptsRef.current <= maxRetryAttempts) {
          console.log(`Reintentando iniciar cámara (intento ${retryAttemptsRef.current} de ${maxRetryAttempts})...`);
          setTimeout(startCamera, 1000);
        } else {
          console.error(`CameraView: Se alcanzó el máximo de ${maxRetryAttempts} intentos para iniciar la cámara sin éxito.`);
        }
      }
    }
  };

  const applyCameraOptimizations = async (videoTrack: MediaStreamTrack, capabilities: MediaTrackCapabilities) => {
    const isAndroid = /android/i.test(navigator.userAgent);
    
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
      }
    } else {
      const advancedConstraints: MediaTrackConstraintSet[] = [];
      
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
        console.log("Aplicando configuraciones avanzadas (no-Android):", advancedConstraints);
        await videoTrack.applyConstraints({
          advanced: advancedConstraints
        });
      }

      if (capabilities.torch) {
        console.log("Activando linterna para mejorar la señal PPG (no-Android)");
        await videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        });
        setTorchEnabled(true);
      } else {
        console.log("La linterna no está disponible en este dispositivo (no-Android)");
      }
    }
  };

  const refreshAutoFocus = useCallback(async () => {
    if (stream && !isFocusing) {
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
  }, [stream, isFocusing]);

  const enableTorch = useCallback(async () => {
    if (stream && !torchEnabled) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.torch) {
        console.log("Activando linterna después de detectar dedo");
        try {
          await videoTrack.applyConstraints({
            advanced: [{ torch: true }]
          });
          setTorchEnabled(true);
        } catch (err) {
          console.error("Error activando linterna:", err);
        }
      }
    }
  }, [stream, torchEnabled]);

  return {
    stream,
    torchEnabled,
    isFocusing,
    startCamera,
    stopCamera,
    refreshAutoFocus,
    enableTorch
  };
};
