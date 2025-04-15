import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CameraViewProps {
  onStreamReady?: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
  setAdjustBrightnessCallback?: (callback: (targetBrightness: number) => Promise<void>) => void;
}

const CameraView = ({ 
  onStreamReady, 
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  setAdjustBrightnessCallback
}: CameraViewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isFocusing, setIsFocusing] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 3;

  const [currentBrightness, setCurrentBrightness] = useState<number | null>(null);
  const [brightnessCapabilities, setBrightnessCapabilities] = useState<MediaTrackCapabilities['brightness'] | null>(null);
  const brightnessCapabilitiesRef = useRef<MediaTrackCapabilities['brightness'] | null>(null);

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

  const stopCamera = useCallback(async () => {
    if (streamRef.current) {
      console.log("Stopping camera stream and turning off torch");
      const tracks = streamRef.current.getTracks();
      for (const track of tracks) {
        try {
          if (track.kind === 'video') {
            const capabilities = track.getCapabilities();
            if (capabilities?.torch) {
              await track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
            }
          }
          track.stop();
        } catch (err) {
          console.error("Error al detener track:", err);
        }
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      streamRef.current = null;
      setTorchEnabled(false);
      retryAttemptsRef.current = 0;
      setCurrentBrightness(null);
      setBrightnessCapabilities(null);
      brightnessCapabilitiesRef.current = null;
      console.log("Camera stopped and stream cleared.");
    }
  }, []);

  const adjustBrightness = useCallback(async (targetBrightness: number) => {
    const stream = streamRef.current;
    const capabilities = brightnessCapabilitiesRef.current;

    if (!stream || !capabilities) {
      console.warn("Stream o capacidades de brillo no disponibles para ajustar.");
      return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
       console.warn("No video track available.");
       return;
    }

    const clampedBrightness = Math.max(
      capabilities.min ?? 0,
      Math.min(capabilities.max ?? 255, Math.round(targetBrightness))
    );

    const currentSettings = videoTrack.getSettings();
    if(currentSettings['brightness'] !== undefined && currentSettings['brightness'] === clampedBrightness){
        return;
    }

    console.log(`Intentando ajustar brillo a: ${clampedBrightness} (Target: ${targetBrightness})`);

    try {
      await videoTrack.applyConstraints({
        advanced: [{ brightness: clampedBrightness }]
      });
      console.log(`Brillo ajustado con éxito a: ${clampedBrightness}`);
      setCurrentBrightness(clampedBrightness);
    } catch (err) {
      console.error("Error al ajustar el brillo:", err);
    }
  }, []);

  useEffect(() => {
    if (setAdjustBrightnessCallback) {
      setAdjustBrightnessCallback(adjustBrightness);
    }
  }, [setAdjustBrightnessCallback, adjustBrightness]);

  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      console.log("Camera stream already exists. Skipping startCamera.");
      return;
    }
    console.log("Attempting to start camera (Ultra-Simplified Constraints)...");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      // *** START SUPER SIMPLE CONSTRAINTS ***
      const constraints: MediaStreamConstraints = {
        video: { facingMode: 'environment' }, // Let browser choose resolution/fps
        audio: false
      };
      // *** END SUPER SIMPLE CONSTRAINTS ***

      /* // Original complex constraints commented out
      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isWindows = /windows nt/i.test(navigator.userAgent);
      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 1280 }, // Use 720p as a common ground
        height: { ideal: 720 },
        frameRate: { ideal: 30 } // Request 30 fps
      };
      const constraints: MediaStreamConstraints = {
        video: baseVideoConstraints,
        audio: false
      };
      */

      console.log("Intentando acceder a la cámara con configuración MUY SIMPLIFICADA:", JSON.stringify(constraints));
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Cámara inicializada correctamente (Simplificado)");
      streamRef.current = newStream; // Store in ref

      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          await new Promise(resolve => setTimeout(resolve, 300));

          const capabilities = videoTrack.getCapabilities();
          console.log("Capacidades de la cámara (Intento Simplificado):", capabilities);

          console.log("--- OMITIENDO CONFIGURACIÓN AVANZADA Y LINTERNA PARA DEBUG ---");
          /*
          // --- START Capability Logging ---
          console.log("--- Verificación de Capacidades Específicas ---");
          if (capabilities.torch) {
            console.log("Torch (Linterna): Soportado");
          } else {
            console.log("Torch (Linterna): NO Soportado");
          }
          if (capabilities.exposureMode) {
            console.log("Exposure Mode: Soportado. Modos:", capabilities.exposureMode);
          } else {
            console.log("Exposure Mode: NO Soportado");
          }
          if (capabilities.exposureCompensation) {
            console.log("Exposure Compensation: Soportado.", capabilities.exposureCompensation);
          } else {
            console.log("Exposure Compensation: NO Soportado");
          }
          if (capabilities.brightness) {
            console.log("Brightness: Soportado.", capabilities.brightness);
            setBrightnessCapabilities(capabilities.brightness);
            brightnessCapabilitiesRef.current = capabilities.brightness;
            
            const currentSettings = videoTrack.getSettings();
             if (currentSettings['brightness'] !== undefined) {
               console.log(`Brillo actual inicial LEIDO: ${currentSettings['brightness']}`);
               setCurrentBrightness(currentSettings['brightness']);
             } else {
               const initialGuess = capabilities.brightness.max !== undefined ? Math.round((capabilities.brightness.min ?? 0 + capabilities.brightness.max) / 2) : 128;
               console.warn(`No se pudo leer el brillo inicial. Asumiendo: ${initialGuess}`);
               setCurrentBrightness(initialGuess);
             }
          } else {
            console.log("Brightness: NO Soportado");
             setBrightnessCapabilities(null);
             brightnessCapabilitiesRef.current = null;
             setCurrentBrightness(null);
          }
           if (capabilities.focusMode) {
             console.log("Focus Mode: Soportado. Modos:", capabilities.focusMode);
           } else {
             console.log("Focus Mode: NO Soportado");
           }
           if (capabilities.whiteBalanceMode) {
            console.log("White Balance Mode: Soportado. Modos:", capabilities.whiteBalanceMode);
          } else {
            console.log("White Balance Mode: NO Soportado");
          }
          console.log("--------------------------------------------");
          // --- END Capability Logging ---


          await new Promise(resolve => setTimeout(resolve, 200));

          const advancedConstraints: MediaTrackConstraintSet[] = [];

          // --- Apply Focus/Exposure constraints (Non-Android) ---
          if (!isAndroid) {
              if (capabilities.exposureMode?.includes('continuous')) {
                 advancedConstraints.push({ exposureMode: 'continuous' });
              }
              if (capabilities.focusMode?.includes('continuous')) {
                 advancedConstraints.push({ focusMode: 'continuous' });
               }
               if (capabilities.whiteBalanceMode?.includes('continuous')) {
                 advancedConstraints.push({ whiteBalanceMode: 'continuous' });
               }

             if (advancedConstraints.length > 0) {
               console.log("Aplicando configuraciones iniciales (Exposición/Foco/Balance):", advancedConstraints);
               await videoTrack.applyConstraints({
                 advanced: advancedConstraints
               });
             }
          }
          // --- End Focus/Exposure constraints ---


          // --- Apply Torch if supported ---
           if (capabilities.torch) {
             console.log("Intentando activar linterna (puede fallar si no está soportado realmente)...");
             try {
               await videoTrack.applyConstraints({ advanced: [{ torch: true }] });
               console.log("Constraint 'torch: true' aplicada sin error inmediato.");
               setTorchEnabled(true);
             } catch (torchErr) {
               console.warn("Error esperado al intentar activar linterna (probablemente no soportado):", torchErr);
               setTorchEnabled(false);
             }
           } else {
             console.log("Linterna no listada en capacidades, no se intenta activar.");
              setTorchEnabled(false);
           }
          // --- End Apply Torch ---
          */
          // *** END TEMPORARY SIMPLIFICATION ***

          if (videoRef.current) {
            videoRef.current.style.transform = 'translateZ(0)';
            videoRef.current.style.backfaceVisibility = 'hidden';
          }

        } catch (err) {
          console.error("Error durante la configuración avanzada de la cámara (ahora simplificada):", err);
        }
      } else {
         console.error("No se encontró video track en el stream.");
         throw new Error("No video track found");
      }

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.style.willChange = 'transform';
        videoRef.current.style.imageRendering = 'crisp-edges';
      }

      if (onStreamReady) {
        onStreamReady(newStream);
      }

      retryAttemptsRef.current = 0;

    } catch (err) {
      console.error("Error al iniciar la cámara:", err);
      streamRef.current = null;

      retryAttemptsRef.current++;
      if (retryAttemptsRef.current <= maxRetryAttempts) {
        console.log(`Reintentando iniciar cámara (intento ${retryAttemptsRef.current} de ${maxRetryAttempts})...`);
        setTimeout(startCamera, 1500);
      } else {
        console.error(`Se alcanzó el máximo de ${maxRetryAttempts} intentos. Falló el inicio de la cámara.`);
      }
    }
  }, [onStreamReady]);

  const refreshAutoFocus = useCallback(async () => {
    const stream = streamRef.current;
    if (stream && !isFocusing && !isAndroid) {
      const videoTrack = stream.getVideoTracks()[0];
       const capabilities = videoTrack?.getCapabilities();
      if (videoTrack && capabilities?.focusMode?.includes('continuous') && capabilities?.focusMode?.includes('manual')) {
        try {
          setIsFocusing(true);
           console.log("Refrescando auto-enfoque...");
          await videoTrack.applyConstraints({ advanced: [{ focusMode: 'manual' }] });
          await new Promise(resolve => setTimeout(resolve, 80));
          await videoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          console.log("Auto-enfoque refrescado.");
        } catch (err) {
          console.error("Error al refrescar auto-enfoque:", err);
        } finally {
          setIsFocusing(false);
        }
      } else {
         // console.log("Auto-enfoque no soportado o no necesario.");
      }
    }
  }, [isFocusing, isAndroid]);

  useEffect(() => {
    if (isMonitoring) {
      console.log("Effect: isMonitoring=true. Llamando a startCamera.");
      startCamera();
    } else {
       console.log("Effect: isMonitoring=false. Llamando a stopCamera.");
       stopCamera();
    }
    return () => {
      console.log("Effect cleanup: isMonitoring cambió a false o el componente se desmonta. Llamando a stopCamera.");
      stopCamera();
    };
  }, [isMonitoring, startCamera, stopCamera]);

  useEffect(() => {
    let focusInterval: NodeJS.Timeout | null = null;
    if (isMonitoring && streamRef.current && isFingerDetected && !isAndroid) {
       console.log("Iniciando intervalo de refresco de auto-enfoque.");
      focusInterval = setInterval(refreshAutoFocus, 7000);
    }
    return () => {
      if (focusInterval) {
         console.log("Limpiando intervalo de refresco de auto-enfoque.");
        clearInterval(focusInterval);
      }
    };
  }, [isMonitoring, isFingerDetected, isAndroid, refreshAutoFocus]);

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
