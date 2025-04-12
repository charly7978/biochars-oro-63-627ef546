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

      // Check if permissions API is available and permissions can be queried
      if (navigator.permissions && navigator.permissions.query) {
        try {
          // Try to query camera permission state
          const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          
          if (permissionStatus.state === 'denied') {
            throw new Error('Camera permission denied. Please allow camera access in your browser settings.');
          }
        } catch (permError) {
          // Some browsers might not support permissions API for camera
          console.warn("Could not check camera permissions:", permError);
        }
      }

      // Some browsers (particularly Chrome) may fail specifically with "Permissions check failed"
      // This happens with sites served over HTTP instead of HTTPS, or with iframes
      // Let's add a specific message for these cases
      try {
        await new Promise<void>((resolve, reject) => {
          // Timeout to handle browsers that hang on permissions
          const timeoutId = setTimeout(() => {
            reject(new Error("Permission request timed out. This might be due to cross-origin restrictions."));
          }, 3000);
          
          // Try a simple permission request
          navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            .then(testStream => {
              // Stop all tracks from test stream immediately
              testStream.getTracks().forEach(track => track.stop());
              clearTimeout(timeoutId);
              resolve();
            })
            .catch(err => {
              clearTimeout(timeoutId);
              reject(err);
            });
        });
      } catch (permissionError) {
        // If there's a specific "Permissions check failed" error, we handle it
        if (permissionError.message && permissionError.message.includes("Permissions check failed")) {
          console.error("Permissions check failed error detected:", permissionError);
          throw new Error("El navegador ha detectado un problema de permisos. Si está usando una conexión HTTP, intente con HTTPS, o si está en un iframe, intente acceder directamente a la aplicación.");
        }
      }

      const isAndroid = /android/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isWindows = /windows nt/i.test(navigator.userAgent);

      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
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
        console.log("Configurando para Windows con resolución reducida (720p)");
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
      
      // First try with preferred constraints
      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log("Cámara inicializada correctamente con configuración óptima");
      } catch (constraintError) {
        console.warn("Failed to get camera with optimal constraints, trying with minimal settings:", constraintError);
        // Fallback to basic constraints if detailed ones fail
        newStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }, 
          audio: false 
        });
        console.log("Cámara inicializada con configuración mínima");
      }
      
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        try {
          const capabilities = videoTrack.getCapabilities();
          console.log("Capacidades de la cámara:", capabilities);
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
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
            }
          } else {
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
            }
          }
          
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
      
    } catch (err: any) {
      console.error("Error al iniciar la cámara:", err);
      
      // Display more specific error messages
      const errorMessage = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || 
                          (err.message && err.message.includes('Permission'))
                          ? 'Permiso de cámara denegado. Por favor, permita el acceso a la cámara en la configuración del navegador.'
                          : `Error de cámara: ${err.message || 'Error desconocido'}`;
      
      // Dispatch a custom event that can be caught by the parent component
      const permissionErrorEvent = new CustomEvent('cameraPermissionError', { 
        detail: { error: err, message: errorMessage } 
      });
      window.dispatchEvent(permissionErrorEvent);
      
      retryAttemptsRef.current++;
      if (retryAttemptsRef.current <= maxRetryAttempts) {
        console.log(`Reintentando iniciar cámara (intento ${retryAttemptsRef.current} de ${maxRetryAttempts})...`);
        setTimeout(startCamera, 1000);
      } else {
        console.error(`Se alcanzó el máximo de ${maxRetryAttempts} intentos sin éxito`);
        
        // Dispatch max retries event
        const maxRetriesEvent = new CustomEvent('cameraMaxRetriesReached', { 
          detail: { error: err, message: errorMessage } 
        });
        window.dispatchEvent(maxRetriesEvent);
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
