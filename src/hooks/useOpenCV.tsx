import { useState, useEffect, useCallback } from 'react';
import OpenCV, { waitForOpenCV, isOpenCVAvailable } from '../opencv/opencv-wrapper';

interface OpenCVHookResult {
  isReady: boolean;
  error: string | null;
  processPPGSignal: typeof OpenCV.processPPGSignal;
  extractPPGFeatures: typeof OpenCV.extractPPGFeatures;
  applyMedianFilter: typeof OpenCV.applyMedianFilter;
  applyGaussianFilter: typeof OpenCV.applyGaussianFilter;
  detectPeaks: typeof OpenCV.detectPeaks;
}

/**
 * Hook para usar OpenCV en componentes React
 * Gestiona la carga asíncrona y proporciona las funciones de procesamiento
 */
export function useOpenCV(): OpenCVHookResult {
  const [isReady, setIsReady] = useState<boolean>(isOpenCVAvailable());
  const [error, setError] = useState<string | null>(null);

  // Inicializar OpenCV al montar el componente
  useEffect(() => {
    let mounted = true;

    const initOpenCV = async () => {
      try {
        // Esperar a que OpenCV esté listo
        await waitForOpenCV();
        if (mounted) {
          setIsReady(true);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          console.error('Error inicializando OpenCV:', err);
          setError('Error al cargar OpenCV');
        }
      }
    };

    if (!isReady) {
      initOpenCV();
    }

    return () => {
      mounted = false;
    };
  }, [isReady]);

  // Wrapper para procesar señal PPG con manejo de errores
  const processPPGSignal = useCallback(async (signal: number[]) => {
    if (!isReady) {
      throw new Error('OpenCV no está listo');
    }
    
    try {
      return await OpenCV.processPPGSignal(signal);
    } catch (err) {
      console.error('Error procesando señal PPG con OpenCV:', err);
      throw new Error('Error en procesamiento PPG');
    }
  }, [isReady]);

  // Wrapper para extraer características PPG con manejo de errores
  const extractPPGFeatures = useCallback(async (signal: number[], sampleRate?: number) => {
    if (!isReady) {
      throw new Error('OpenCV no está listo');
    }
    
    try {
      return await OpenCV.extractPPGFeatures(signal, sampleRate);
    } catch (err) {
      console.error('Error extrayendo características PPG con OpenCV:', err);
      throw new Error('Error en extracción de características');
    }
  }, [isReady]);

  // Wrapper para filtrado de mediana
  const applyMedianFilter = useCallback((signal: number[], kernelSize?: number) => {
    if (!isReady) {
      console.warn('OpenCV no está listo para filtrado');
      return signal;
    }
    
    try {
      return OpenCV.applyMedianFilter(signal, kernelSize);
    } catch (err) {
      console.error('Error aplicando filtro de mediana:', err);
      return signal;
    }
  }, [isReady]);

  // Wrapper para filtrado gaussiano
  const applyGaussianFilter = useCallback((signal: number[], kernelSize?: number, sigma?: number) => {
    if (!isReady) {
      console.warn('OpenCV no está listo para filtrado');
      return signal;
    }
    
    try {
      return OpenCV.applyGaussianFilter(signal, kernelSize, sigma);
    } catch (err) {
      console.error('Error aplicando filtro gaussiano:', err);
      return signal;
    }
  }, [isReady]);

  // Wrapper para detección de picos
  const detectPeaks = useCallback((signal: number[]) => {
    if (!isReady) {
      console.warn('OpenCV no está listo para detección de picos');
      return [];
    }
    
    try {
      return OpenCV.detectPeaks(signal);
    } catch (err) {
      console.error('Error detectando picos:', err);
      return [];
    }
  }, [isReady]);

  return {
    isReady,
    error,
    processPPGSignal,
    extractPPGFeatures,
    applyMedianFilter,
    applyGaussianFilter,
    detectPeaks
  };
}

export default useOpenCV; 