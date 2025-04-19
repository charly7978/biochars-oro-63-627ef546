
import { useEffect, useState, useCallback } from 'react';
import { useMultipleTensorFlowModels } from '@/hooks/useTensorFlowModel';

const REQUIRED_MODELS = [
  'heartRate',
  'spo2',
  'bloodPressure',
  'arrhythmia',
  'glucose',
  // Asegurar incluir todos los modelos usados globalmente
];

export function useEnginesReady() {
  const [isOpenCVReady, setIsOpenCVReady] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvTries, setCvTries] = useState(0);
  const maxCvTries = 15;

  // TensorFlow loading of all relevant models
  const {
    modelsReady: isTensorFlowReady,
    isLoading: isTensorFlowLoading,
    error: tfError,
    reloadAllModels
  } = useMultipleTensorFlowModels(REQUIRED_MODELS);

  // Polling for OpenCV readiness
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let tries = 0;

    function checkOpenCV() {
      tries++;
      if (window.cv && (window as any).cvReady) {
        setIsOpenCVReady(true);
        setCvError(null);
        clearInterval(interval);
      } else if (tries >= maxCvTries) {
        setIsOpenCVReady(false);
        setCvError('No se pudo inicializar OpenCV tras varios intentos.');
        clearInterval(interval);
      }
    }

    checkOpenCV();
    if (!isOpenCVReady) {
      interval = setInterval(checkOpenCV, 1000);
    }

    return () => clearInterval(interval);
  }, [isOpenCVReady, cvTries]);

  // Retry for OpenCV forcing
  const retryOpenCV = useCallback(() => {
    setCvTries(t => t + 1);
  }, []);

  // Retry for TensorFlow models reloading
  const retryTensorFlowModels = useCallback(() => {
    reloadAllModels();
  }, [reloadAllModels]);

  return {
    isOpenCVReady,
    isTensorFlowReady,
    isTensorFlowLoading,
    error: cvError || tfError,
    retryOpenCV,
    retryTensorFlowModels,
  };
}
