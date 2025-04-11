
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Progress } from "@/components/ui/progress"
import { FeedbackService } from '@/services/FeedbackService';
import { useHeartbeatFeedback } from '@/hooks/useHeartbeatFeedback';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface PPGSignalMeterProps {
  value: number;
  quality: number;
  isFingerDetected: boolean;
  onStartMeasurement: () => void;
  onReset: () => void;
  arrhythmiaStatus: string;
  rawArrhythmiaData?: any | null;
}

const PPGSignalMeter: React.FC<PPGSignalMeterProps> = ({ 
  value, 
  quality, 
  isFingerDetected,
  onStartMeasurement,
  onReset,
  arrhythmiaStatus,
  rawArrhythmiaData
}) => {
  const [progress, setProgress] = useState(0);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isArrhythmiaDetected, setIsArrhythmiaDetected] = useState(false);
  const [arrhythmiaCount, setArrhythmiaCount] = useState(0);
  const [transitionActive, setTransitionActive] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [transitionDirection, setTransitionDirection] = useState<'in' | 'out'>('in');
  const [showRawData, setShowRawData] = useState(false);
  
  const triggerHeartbeat = useHeartbeatFeedback(true);
  
  const animationFrameRef = useRef<number | null>(null);
  const transitionStartRef = useRef<number>(0);
  const arrhythmiaStatusRef = useRef<string>(arrhythmiaStatus);
  const rawArrhythmiaDataRef = useRef<any | null>(rawArrhythmiaData);
  
  const MAX_ARRHYTHMIAS = 3;
  
  const qualityClass = quality > 60 ? "good" : quality > 30 ? "medium" : "poor";

  const startCalibration = () => {
    setIsCalibrating(true);
    setProgress(0);
  };

  const stopCalibration = () => {
    setIsCalibrating(false);
    setProgress(0);
  };

  useEffect(() => {
    if (isFingerDetected && quality > 10) {
      setProgress(quality);
    } else {
      setProgress(0);
    }
  }, [isFingerDetected, quality]);

  useEffect(() => {
    if (arrhythmiaStatus !== arrhythmiaStatusRef.current) {
      arrhythmiaStatusRef.current = arrhythmiaStatus;
      
      if (arrhythmiaStatus.includes('true')) {
        setIsArrhythmiaDetected(true);
        setArrhythmiaCount(prevCount => Math.min(prevCount + 1, MAX_ARRHYTHMIAS));
        
        // Trigger feedback
        FeedbackService.signalArrhythmia(arrhythmiaCount + 1);
        triggerHeartbeat('arrhythmia');
        
        // Start transition
        setTransitionDirection('in');
        setTransitionActive(true);
        transitionStartRef.current = performance.now();
        
        const animateTransition = (currentTime: number) => {
          const elapsed = currentTime - transitionStartRef.current;
          let progress = elapsed / 500; // Transition duration of 500ms
          
          if (transitionDirection === 'out') {
            progress = 1 - progress;
          }
          
          setTransitionProgress(progress);
          
          if (progress >= 1) {
            setTransitionActive(false);
            setTransitionProgress(0);
            
            if (transitionDirection === 'in') {
              setTimeout(() => {
                setTransitionDirection('out');
                setTransitionActive(true);
                transitionStartRef.current = performance.now();
                
                if (animationFrameRef.current) {
                  cancelAnimationFrame(animationFrameRef.current);
                }
                animationFrameRef.current = requestAnimationFrame(animateTransition);
              }, 2000); // Delay before starting the fade-out
            }
          } else {
            animationFrameRef.current = requestAnimationFrame(animateTransition);
          }
        };
        
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(animateTransition);
      } else {
        setIsArrhythmiaDetected(false);
        setArrhythmiaCount(0);
      }
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [arrhythmiaStatus, triggerHeartbeat]);
  
  const toggleRawData = () => {
    setShowRawData(!showRawData);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="relative w-48 h-48">
        <div
          className={`absolute inset-0 rounded-full border-4 border-gray-700 transition-opacity duration-500 ${
            isFingerDetected ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <Progress
          className="absolute inset-0"
          value={progress}
          color={qualityClass}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          {isCalibrating ? (
            <div className="animate-pulse text-4xl font-bold text-white">...</div>
          ) : (
            <div className="text-4xl font-bold text-white">
              {isFingerDetected ? `${quality}%` : '--'}
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-4 text-center">
        <div className={`text-xl font-medium text-gray-300 transition duration-300 ${isFingerDetected ? 'opacity-100' : 'opacity-0'}`}>
          {isFingerDetected ? 'SEÑAL DETECTADA' : 'NO SEÑAL'}
        </div>
        <div className={`text-sm text-gray-500 transition duration-300 ${isFingerDetected ? 'opacity-100' : 'opacity-0'}`}>
          CALIDAD: <span className={`font-semibold ${qualityClass}`}>{qualityClass.toUpperCase()}</span>
        </div>
      </div>
      
      {isArrhythmiaDetected && (
        <div
          className={`absolute inset-0 flex items-center justify-center bg-red-500 bg-opacity-50 text-white text-2xl font-bold rounded-xl transition duration-500 pointer-events-none ${transitionActive ? 'opacity-100' : 'opacity-0'}`}
          style={{
            opacity: transitionActive ? transitionProgress : 0,
          }}
        >
          ¡ARRITMIA DETECTADA!
        </div>
      )}

      <div className="mt-6 flex space-x-4">
        <button
          className="px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 active:bg-green-800 transition-colors duration-200"
          onClick={onStartMeasurement}
          disabled={isCalibrating}
        >
          {isCalibrating ? 'CALIBRANDO...' : 'INICIAR MEDICIÓN'}
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 active:bg-red-800 transition-colors duration-200"
              disabled={isCalibrating}
            >
              REINICIAR
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción reiniciará la medición y borrará todos los datos.
                ¿Estás seguro de que quieres continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onReset}>Reiniciar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      
      <button
        className="mt-4 text-blue-400 hover:text-blue-500 transition-colors duration-200"
        onClick={toggleRawData}
      >
        {showRawData ? 'Ocultar Datos Brutos' : 'Mostrar Datos Brutos'}
      </button>
      
      {showRawData && rawArrhythmiaData && (
        <div className="mt-4 text-left text-gray-400">
          <h4 className="font-semibold text-gray-300">Datos Brutos de Arritmia:</h4>
          <pre className="text-xs">
            {JSON.stringify(rawArrhythmiaData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default PPGSignalMeter;
