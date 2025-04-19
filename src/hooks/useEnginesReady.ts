import { useEffect, useState, useCallback } from 'react';
import { useTensorFlowModel } from '@/hooks/useTensorFlowModel';

export function useEnginesReady() {
  const [isOpenCVReady, setIsOpenCVReady] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvTries, setCvTries] = useState(0);
  const maxCvTries = 10;

  // TensorFlow
  const {
    isReady: isTensorFlowReady,
    error: tfError
  } = useTensorFlowModel('vital-signs-ppg', true);

  // OpenCV polling
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
        setCvError('No se pudo inicializar OpenCV.');
        clearInterval(interval);
      }
    }
    checkOpenCV();
    if (!isOpenCVReady) {
      interval = setInterval(checkOpenCV, 1000);
    }
    return () => clearInterval(interval);
  }, [isOpenCVReady, cvTries]);

  // Retry handler
  const retry = useCallback(() => {
    setCvTries(t => t + 1);
  }, []);

  return {
    isOpenCVReady,
    isTensorFlowReady,
    error: cvError || tfError || null,
    retry
  };
} 