
import React, { useState, useEffect } from 'react';
import './App.css';
import { isOpenCVAvailable, waitForOpenCV } from './opencv/opencv-wrapper';
import { Progress } from "./components/ui/progress";

const App: React.FC = () => {
  const [opencvStatus, setOpencvStatus] = useState<string>('Iniciando...');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    let progressInterval: number | undefined;

    const checkOpenCV = async () => {
      try {
        console.log('[App] Iniciando carga de OpenCV...');
        setOpencvStatus('Cargando OpenCV...');
        
        // Initial check
        if (isOpenCVAvailable()) {
          if (isMounted) {
            console.log('[App] OpenCV ya está disponible al inicio');
            setOpencvStatus('OpenCV ya estaba disponible');
            setIsReady(true);
            setLoadingProgress(100);
          }
          return;
        }
        
        // Show visual progress while waiting (not simulated)
        progressInterval = window.setInterval(() => {
          if (isMounted && loadingProgress < 90) {
            setLoadingProgress(prev => {
              // Gradual progress increases during wait
              const increment = prev < 30 ? 5 : prev < 60 ? 3 : 1;
              return Math.min(90, prev + increment);
            });
          }
        }, 500);
        
        // Wait for OpenCV with sufficient timeout
        await waitForOpenCV(20000);
        
        // Check if OpenCV is actually available now
        if (isMounted) {
          if (isOpenCVAvailable()) {
            console.log('[App] OpenCV cargado con éxito');
            setOpencvStatus('OpenCV cargado correctamente');
            setIsReady(true);
            setLoadingProgress(100);
          } else {
            throw new Error('OpenCV no está disponible después de la carga');
          }
        }
      } catch (err) {
        if (!isMounted) return;
        
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[App] Error en la carga de OpenCV:', errorMessage);
        setError(`Error al cargar OpenCV: ${errorMessage}`);
        setOpencvStatus('Error en la carga');
        setLoadingProgress(0);
      } finally {
        if (progressInterval) {
          clearInterval(progressInterval);
        }
      }
    };

    // Start OpenCV verification
    checkOpenCV();

    // Cleanup when unmounting
    return () => {
      isMounted = false;
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [retryCount]); // Retry when retryCount changes

  // Function to retry loading
  const handleRetry = () => {
    console.log('[App] Reintentando cargar OpenCV...');
    setOpencvStatus('Reintentando carga...');
    setLoadingProgress(0);
    setError(null);
    setRetryCount(prev => prev + 1);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-400 bg-clip-text text-transparent py-2 mb-4">
          Monitoreo Avanzado de Signos Vitales
        </h1>
        <p className="status">{opencvStatus}</p>
        
        <div className="loading-container">
          <Progress value={loadingProgress} className="w-full h-2" />
        </div>
        
        {error && (
          <div className="error-message">
            <p>{error}</p>
            <p>Verifique su conexión a internet e intente nuevamente.</p>
          </div>
        )}
        
        {!isReady && (
          <button 
            onClick={handleRetry}
            className="retry-button"
          >
            Reintentar
          </button>
        )}
        
        {isReady && (
          <p className="success-message">
            La aplicación está lista para usar.
          </p>
        )}
      </header>
    </div>
  );
};

export default App;
