import { useEffect, useState } from 'react';
import { useTensorFlowModel } from '@/hooks/useTensorFlowModel';

export function useEnginesReady() {
  const [isOpenCVReady, setIsOpenCVReady] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvTries, setCvTries] = useState(0);
  const maxWaitMs = 10000; // 10 segundos

  // TensorFlow
  const {
    isReady: isTensorFlowReady,
    error: tfError
  } = useTensorFlowModel('vital-signs-ppg', true);

  // OpenCV polling robusto
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let timeout: NodeJS.Timeout;
    function checkOpenCV() {
      if (window.cv && (window as any).cvReady) {
        setIsOpenCVReady(true);
        setCvError(null);
        clearInterval(interval);
        clearTimeout(timeout);
      }
    }
    checkOpenCV();
    if (!isOpenCVReady) {
      interval = setInterval(checkOpenCV, 300);
      timeout = setTimeout(() => {
        setIsOpenCVReady(false);
        setCvError('OpenCV no se cargó correctamente tras 10 segundos. Verifica tu conexión o la ruta del script.');
        clearInterval(interval);
      }, maxWaitMs);
    }
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isOpenCVReady, cvTries]);

  let error: string | null = null;
  if (cvError) error = cvError;
  else if (tfError) error = `TensorFlow: ${tfError}`;

  return {
    isOpenCVReady,
    isTensorFlowReady,
    error
  };
}
