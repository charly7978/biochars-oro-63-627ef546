
import { useState, useRef, useCallback } from "react";
import { useSignalProcessor } from "./useSignalProcessor";
import { useVitalSignsProcessor } from "./useVitalSignsProcessor";

export function useMonitoring() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const measurementTimerRef = useRef<number | null>(null);
  
  const { startProcessing, stopProcessing } = useSignalProcessor();
  const { 
    reset: resetVitalSigns,
    fullReset: fullResetVitalSigns,
  } = useVitalSignsProcessor();

  const enterFullScreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.log('Error al entrar en pantalla completa:', err);
    }
  };

  const startMonitoring = useCallback(() => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      enterFullScreen();
      setIsMonitoring(true);
      setIsCameraOn(true);
      setShowResults(false);
      
      // Iniciar procesamiento de señal
      startProcessing();
      
      // Resetear valores
      setElapsedTime(0);
      
      // Iniciar temporizador para medición
      if (measurementTimerRef.current) {
        clearInterval(measurementTimerRef.current);
      }
      
      measurementTimerRef.current = window.setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          console.log(`Tiempo transcurrido: ${newTime}s`);
          
          // Finalizar medición después de 30 segundos
          if (newTime >= 30) {
            finalizeMeasurement();
            return 30;
          }
          return newTime;
        });
      }, 1000);
    }
  }, [isMonitoring, startProcessing]);

  const finalizeMeasurement = useCallback(() => {
    console.log("Finalizando medición: manteniendo resultados");
    
    setIsMonitoring(false);
    setIsCameraOn(false);
    stopProcessing();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    const savedResults = resetVitalSigns();
    if (savedResults) {
      setShowResults(true);
    }
    
    setElapsedTime(0);
  }, [stopProcessing, resetVitalSigns]);

  const handleReset = useCallback(() => {
    console.log("Reseteando completamente la aplicación");
    setIsMonitoring(false);
    setIsCameraOn(false);
    setShowResults(false);
    stopProcessing();
    
    if (measurementTimerRef.current) {
      clearInterval(measurementTimerRef.current);
      measurementTimerRef.current = null;
    }
    
    fullResetVitalSigns();
    setElapsedTime(0);
  }, [stopProcessing, fullResetVitalSigns]);

  const handleToggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      finalizeMeasurement();
    } else {
      startMonitoring();
    }
  }, [isMonitoring, finalizeMeasurement, startMonitoring]);

  return {
    isMonitoring,
    isCameraOn,
    elapsedTime,
    showResults,
    setShowResults,
    startMonitoring,
    finalizeMeasurement,
    handleReset,
    handleToggleMonitoring
  };
}
