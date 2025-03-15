/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { useVitalSignsProcessor } from '../hooks/useVitalSignsProcessor';
import CameraView from '../components/CameraView';
import VitalResults from '../components/VitalResults';
import SignalQualityIndicator from '../components/SignalQualityIndicator';
import PPGSignalMeter from '../components/PPGSignalMeter';

interface ProcessedSignal {
  timestamp: number;
  rawValue: number;
  filteredValue: number;
  quality: number;
  fingerDetected: boolean;
  roi?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  physicalSignatureScore?: number;
}

interface RRData {
  intervals: number[];
  lastPeakTime: number | null;
}

const Index = () => {
  // Estados principales
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [signalQuality, setSignalQuality] = useState(0);
  const [fingerDetected, setFingerDetected] = useState(false);
  const [signalValue, setSignalValue] = useState(0);
  const [showSignalMeter, setShowSignalMeter] = useState(false);
  const [rrData, setRRData] = useState<RRData>({ intervals: [], lastPeakTime: null });
  
  // Referencias
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signalProcessorRef = useRef<any>(null);
  const heartBeatProcessorRef = useRef<any>(null);
  const processingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);
  const maxRetriesRef = useRef(5);
  
  // Procesar signos vitales con useVitalSignsProcessor
  const {
    processSignal,
    reset: resetVitalSigns,
    fullReset,
    arrhythmiaCounter,
    lastValidResults,
    debugInfo
  } = useVitalSignsProcessor();

  // Inicializar procesadores y cámara
  useEffect(() => {
    if (isMonitoring) {
      console.log('Index: Inicializando procesadores', {
        timestamp: new Date().toISOString()
      });
      
      // Iniciar procesador de señal
      import('../utils/PPGSignalProcessor').then(module => {
        const PPGSignalProcessor = module.PPGSignalProcessor;
        
        signalProcessorRef.current = new PPGSignalProcessor(
          (signal: ProcessedSignal) => {
            setSignalQuality(signal.quality);
            setFingerDetected(signal.fingerDetected);
            setSignalValue(signal.filteredValue);
            
            // Procesar la señal PPG para signos vitales
            if (signal.fingerDetected) {
              processSignal(signal.filteredValue, rrData);
            }
          },
          (error: any) => {
            console.error('Error en procesador de señal PPG:', error);
          }
        );
        
        signalProcessorRef.current.start();
        signalProcessorRef.current.calibrate();
      });
      
      // Iniciar procesador de ritmo cardíaco
      import('../modules/HeartBeatProcessor').then(module => {
        const HeartBeatProcessor = module.HeartBeatProcessor;
        
        heartBeatProcessorRef.current = new HeartBeatProcessor();
        (window as any).heartBeatProcessor = heartBeatProcessorRef.current;
        
        heartBeatProcessorRef.current.onPeakDetected = (intervals: number[], lastPeakTime: number | null) => {
          setRRData({ intervals, lastPeakTime });
        };
      });
      
      // Iniciar captura de cámara
      initCamera();
    } else {
      stopProcessing();
    }
    
    return () => {
      stopProcessing();
    };
  }, [isMonitoring, processSignal]);

  // Inicializar la cámara
  const initCamera = useCallback(async () => {
    try {
      if (videoRef.current) {
        // Parámetros mejorados para cámara
        const constraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
            exposureMode: 'manual' as any,
            focusMode: 'manual' as any,
            whiteBalanceMode: 'manual' as any,
            exposureCompensation: 1.0 as any,
          },
          audio: false
        };
        
        // Solicitar acceso a la cámara con constraints personalizados
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (stream) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          
          // Dar tiempo a la cámara para estabilizar la exposición y flash
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Iniciar procesamiento de frames con interval en lugar de requestAnimationFrame para mayor estabilidad
          if (processingIntervalRef.current === null) {
            processingIntervalRef.current = setInterval(() => {
              processImage();
            }, 33); // ~30fps
            
            console.log('Index: Procesamiento iniciado con interval', {
              timestamp: new Date().toISOString()
            });
          }
          
          retryCountRef.current = 0;
          console.log('Cámara inicializada exitosamente');
        }
      }
    } catch (error) {
      console.error('Error iniciando cámara:', error);
      
      // Intentar nuevamente con configuración reducida si falló
      if (retryCountRef.current < maxRetriesRef.current) {
        retryCountRef.current++;
        console.log(`Reintentando inicialización de cámara (${retryCountRef.current}/${maxRetriesRef.current})...`);
        
        // Esperar un momento y reintentar con configuración más simple
        setTimeout(() => {
          initCameraWithFallback();
        }, 1000);
      }
    }
  }, []);

  // Inicializar cámara con configuración de fallback
  const initCameraWithFallback = useCallback(async () => {
    try {
      if (videoRef.current) {
        // Configuración más simple para mayor compatibilidad
        const simpleConstraints = {
          video: { facingMode: 'environment' },
          audio: false
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(simpleConstraints);
        
        if (stream) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          
          if (processingIntervalRef.current === null) {
            processingIntervalRef.current = setInterval(() => {
              processImage();
            }, 33);
          }
          
          console.log('Cámara inicializada con configuración de fallback');
        }
      }
    } catch (error) {
      console.error('Error persistente iniciando cámara:', error);
    }
  }, []);

  // Procesar imagen del video
  const processImage = useCallback(() => {
    try {
      if (
        !videoRef.current ||
        !canvasRef.current ||
        !signalProcessorRef.current ||
        !heartBeatProcessorRef.current ||
        !videoRef.current.videoWidth
      ) {
        return;
      }
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;
      
      // Ajustar canvas al tamaño del video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Verificar que el video esté activo y tenga un track válido
      const videoTracks = (video.srcObject as MediaStream)?.getVideoTracks();
      if (!videoTracks || videoTracks.length === 0 || videoTracks[0].readyState !== 'live') {
        console.error('Video track no válido o inactivo');
        return;
      }
      
      // Dibujar en el centro del frame
      const centerX = video.videoWidth / 2;
      const centerY = video.videoHeight / 2;
      const size = Math.min(video.videoWidth, video.videoHeight) / 2;
      
      ctx.drawImage(
        video,
        centerX - size / 2,
        centerY - size / 2,
        size,
        size,
        0,
        0,
        canvas.width,
        canvas.height
      );
      
      // Obtener datos de la imagen
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Procesar con el procesador de señal
      signalProcessorRef.current.processFrame(imageData);
      
      // Procesar con el procesador de ritmo cardíaco
      heartBeatProcessorRef.current.processImageData(imageData);
    } catch (error: any) {
      console.error('Error capturando frame:', error);
      
      // Si hay un error persistente con el track, reintentar la inicialización
      if (error?.name === 'InvalidStateError' && error?.message?.includes('Track')) {
        if (retryCountRef.current < maxRetriesRef.current) {
          retryCountRef.current++;
          console.log(`Error de track detectado, reintentando inicialización (${retryCountRef.current}/${maxRetriesRef.current})...`);
          
          // Limpiar recursos actuales
          stopProcessing();
          
          // Esperar un momento y reintentar
          setTimeout(() => {
            setIsMonitoring(true);
          }, 1500);
        }
      }
    }
  }, []);

  // Detener procesamiento
  const stopProcessing = useCallback(() => {
    // Detener interval de procesamiento
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }
    
    // Detener procesador de señal
    if (signalProcessorRef.current) {
      signalProcessorRef.current.stop();
      signalProcessorRef.current = null;
    }
    
    // Detener procesador de ritmo cardíaco
    if (heartBeatProcessorRef.current) {
      heartBeatProcessorRef.current = null;
      (window as any).heartBeatProcessor = null;
    }
    
    // Detener stream de video
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setRRData({ intervals: [], lastPeakTime: null });
  }, []);

  // Manejadores de eventos
  const handleStartMeasurement = () => {
    setIsMonitoring(true);
    setShowSignalMeter(true);
  };

  const handleReset = () => {
    setIsMonitoring(false);
    setShowSignalMeter(false);
    
    if (signalProcessorRef.current) {
      signalProcessorRef.current.resetToDefault();
    }
    
    resetVitalSigns();
  };

  const handleFullReset = () => {
    handleReset();
    fullReset();
  };

  useEffect(() => {
    // Escuchar evento de measurement complete
    const handleMeasurementComplete = () => {
      setIsMonitoring(false);
      console.log("Medición completa");
    };
    
    window.addEventListener("measurementComplete", handleMeasurementComplete);
    return () => window.removeEventListener("measurementComplete", handleMeasurementComplete);
  }, []);

  return (
    <div className="flex flex-col h-full w-full relative">
      {!showSignalMeter && (
        <div className="absolute inset-0 flex flex-col z-10">
          <CameraView 
            videoRef={videoRef} 
            canvasRef={canvasRef} 
            isMonitoring={isMonitoring}
            isFingerDetected={fingerDetected}
            signalQuality={signalQuality}
          />
          
          <div className="absolute left-0 right-0 top-0 px-2 py-1">
            <SignalQualityIndicator 
              quality={signalQuality} 
              isMonitoring={isMonitoring}
            />
          </div>
          
          <div className="mt-auto px-4 pb-6">
            <VitalResults 
              isMonitoring={isMonitoring} 
              fingerDetected={fingerDetected}
              signalQuality={signalQuality}
              arrhythmiaCount={arrhythmiaCounter}
              lastValidResults={lastValidResults}
              onStartMeasurement={handleStartMeasurement}
              onReset={handleFullReset}
            />
            
            <div className="mt-6 text-center">
              <Link 
                to="/about" 
                className="text-xs text-gray-600 bg-white/80 px-2 py-1 rounded-md"
              >
                Acerca de esta aplicación
              </Link>
            </div>
          </div>
        </div>
      )}
      
      {showSignalMeter && (
        <PPGSignalMeter
          value={signalValue}
          quality={signalQuality}
          isFingerDetected={fingerDetected}
          onStartMeasurement={() => setIsMonitoring(true)}
          onReset={handleReset}
          arrhythmiaStatus={lastValidResults?.arrhythmiaStatus}
          rawArrhythmiaData={lastValidResults?.lastArrhythmiaData}
          preserveResults={!isMonitoring}
        />
      )}
    </div>
  );
};

export default Index;
