
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CameraFrameProcessor } from './CameraFrameProcessor';
import { ProcessedPPGSignal } from '../signal-processing/types';

interface CameraViewProps {
  onFrameProcessed?: (ppgSignal: ProcessedPPGSignal, heartBeatData: {
    isPeak: boolean;
    intervals: number[];
    lastPeakTime: number | null;
  }) => void;
  onStreamReady?: (stream: MediaStream) => void;
  isMonitoring: boolean;
  isFingerDetected?: boolean;
  signalQuality?: number;
  frameRate?: number;
}

const CameraView: React.FC<CameraViewProps> = ({ 
  onFrameProcessed, 
  onStreamReady,
  isMonitoring, 
  isFingerDetected = false, 
  signalQuality = 0,
  frameRate = 30
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isFocusing, setIsFocusing] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const retryAttemptsRef = useRef<number>(0);
  const maxRetryAttempts = 3;
  const frameProcessorRef = useRef<CameraFrameProcessor | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Inicializar el procesador de frames
  useEffect(() => {
    if (!frameProcessorRef.current) {
      frameProcessorRef.current = new CameraFrameProcessor();
      console.log("CameraView: Procesador de frames inicializado");
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);
  
  // Configurar procesador según frameRate
  useEffect(() => {
    if (frameProcessorRef.current) {
      frameProcessorRef.current.setProcessingInterval(1000 / frameRate);
    }
  }, [frameRate]);

  // Detectar plataforma
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const androidDetected = /android/i.test(userAgent);
    const iosDetected = /ipad|iphone|ipod/i.test(userAgent);
    
    console.log("CameraView: Plataforma detectada:", {
      userAgent,
      isAndroid: androidDetected,
      isIOS: iosDetected,
      isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent)
    });
    
    setIsAndroid(androidDetected);
    setIsIOS(iosDetected);
  }, []);

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (stream) {
      console.log("CameraView: Deteniendo stream de cámara y apagando linterna");
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
  }, [stream]);

  // Función para procesar frames
  const processVideoFrame = useCallback(() => {
    if (!isMonitoring || !videoRef.current || !videoRef.current.videoWidth || !frameProcessorRef.current) {
      return;
    }
    
    try {
      // Crear canvas si no existe
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) {
        console.error("No se pudo obtener contexto 2D del canvas");
        return;
      }
      
      // Ajustar tamaño del canvas
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      
      // Dibujar frame en el canvas
      ctx.drawImage(videoRef.current, 0, 0);
      
      // Obtener datos de imagen
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Procesar frame
      const processingResult = frameProcessorRef.current.processFrame(imageData);
      
      // Enviar resultados al callback
      if (processingResult && onFrameProcessed) {
        onFrameProcessed(processingResult.ppgSignal, processingResult.heartBeatData);
      }
    } catch (error) {
      console.error("Error procesando frame de video:", error);
    }
    
    // Programar siguiente frame
    animationFrameRef.current = requestAnimationFrame(processVideoFrame);
  }, [isMonitoring, onFrameProcessed]);

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia no está soportado");
      }

      const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      };

      if (isAndroid) {
        console.log("CameraView: Configurando para Android");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 30, max: 60 },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        });
      } else if (isIOS) {
        console.log("CameraView: Configurando para iOS");
        Object.assign(baseVideoConstraints, {
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        });
      } else {
        console.log("CameraView: Configurando para escritorio con máxima resolución");
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

      console.log("CameraView: Intentando acceder a la cámara con configuración:", constraints);
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("CameraView: Cámara inicializada correctamente");
      
      const videoTrack = newStream.getVideoTracks()[0];

      if (videoTrack) {
        // Configurar cámara según dispositivo
        const capabilities = videoTrack.getCapabilities();
        console.log("CameraView: Capacidades de la cámara:", capabilities);
        
        const advancedConstraints: MediaTrackConstraintSet[] = [];
        
        if (isAndroid) {
          try {
            if (capabilities.torch) {
              console.log("CameraView: Activando linterna en Android");
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
          
          if (advancedConstraints.length > 0) {
            console.log("CameraView: Aplicando configuraciones avanzadas:", advancedConstraints);
            await videoTrack.applyConstraints({
              advanced: advancedConstraints
            });
          }

          if (capabilities.torch) {
            console.log("CameraView: Activando linterna para mejorar la señal PPG");
            await videoTrack.applyConstraints({
              advanced: [{ torch: true }]
            });
            setTorchEnabled(true);
          }
        }
        
        // Configurar video
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.style.willChange = 'transform';
          videoRef.current.style.transform = 'translateZ(0)';
          videoRef.current.style.imageRendering = 'crisp-edges';
          videoRef.current.style.backfaceVisibility = 'hidden';
          videoRef.current.style.perspective = '1000px';
        }

        setStream(newStream);
        
        // Iniciar procesamiento de frames
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(processVideoFrame);
        
        // Notificar que el stream está listo
        if (onStreamReady) {
          onStreamReady(newStream);
        }
        
        retryAttemptsRef.current = 0;
      }
    } catch (err) {
      console.error("CameraView: Error al iniciar la cámara:", err);
      
      retryAttemptsRef.current++;
      if (retryAttemptsRef.current <= maxRetryAttempts) {
        console.log(`CameraView: Reintentando iniciar cámara (intento ${retryAttemptsRef.current} de ${maxRetryAttempts})...`);
        setTimeout(startCamera, 1000);
      } else {
        console.error(`CameraView: Se alcanzó el máximo de ${maxRetryAttempts} intentos sin éxito`);
      }
    }
  }, [isAndroid, isIOS, onStreamReady, processVideoFrame]);

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
          console.log("CameraView: Auto-enfoque refrescado con éxito");
        } catch (err) {
          console.error("Error al refrescar auto-enfoque:", err);
        } finally {
          setIsFocusing(false);
        }
      }
    }
  }, [stream, isFocusing, isAndroid]);

  // Manejar inicio/detención de cámara según estado de monitoreo
  useEffect(() => {
    if (isMonitoring && !stream) {
      console.log("CameraView: Starting camera because isMonitoring=true");
      startCamera();
    } else if (!isMonitoring && stream) {
      console.log("CameraView: Stopping camera because isMonitoring=false");
      stopCamera();
    }
    
    return () => {
      console.log("CameraView: Component unmounting, stopping camera");
      stopCamera();
    };
  }, [isMonitoring, stream, startCamera, stopCamera]);

  // Manejar linterna y enfoque cuando se detecta dedo
  useEffect(() => {
    if (stream && isFingerDetected && !torchEnabled) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && videoTrack.getCapabilities()?.torch) {
        console.log("CameraView: Activando linterna después de detectar dedo");
        videoTrack.applyConstraints({
          advanced: [{ torch: true }]
        }).then(() => {
          setTorchEnabled(true);
        }).catch(err => {
          console.error("Error activando linterna:", err);
        });
      }
    }
    
    // Refrescar enfoque periódicamente si se detectó dedo
    if (isFingerDetected && !isAndroid) {
      const focusInterval = setInterval(refreshAutoFocus, 5000);
      return () => clearInterval(focusInterval);
    }
  }, [stream, isFingerDetected, torchEnabled, refreshAutoFocus, isAndroid]);

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
