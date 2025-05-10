
import React, { useState, useEffect } from 'react';
import './App.css';
import { isOpenCVAvailable, waitForOpenCV } from './opencv/opencv-wrapper';
import { Progress } from "./components/ui/progress";

const App: React.FC = () => {
  const [opencvStatus, setOpencvStatus] = useState<string>('Iniciando...');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let progressInterval: number | null = null;

    const checkOpenCV = async () => {
      try {
        console.log('Iniciando carga de OpenCV...');
        setOpencvStatus('Cargando OpenCV...');
        setLoadingProgress(10);
        
        // Intentar cargar OpenCV con 30 segundos de timeout
        await waitForOpenCV(30000);
        
        if (!isMounted) return;
        
        // Verificar realmente si OpenCV está disponible
        if (isOpenCVAvailable() && window.cv) {
          setOpencvStatus('OpenCV cargado correctamente');
          setIsReady(true);
          setLoadingProgress(100);
          console.log('OpenCV verificado y disponible');
        } else {
          throw new Error('OpenCV no está disponible después de la carga');
        }
      } catch (err) {
        if (!isMounted) return;
        
        console.error('Error fatal en la carga de OpenCV:', err);
        setError(`Error al cargar OpenCV: ${err instanceof Error ? err.message : String(err)}`);
        setOpencvStatus('Error en la carga de OpenCV');
      }
    };

    checkOpenCV();

    return () => {
      isMounted = false;
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, []);

  // Función para reintentar la carga
  const handleRetry = () => {
    console.log('Reintentando cargar OpenCV...');
    setOpencvStatus('Reintentando...');
    setLoadingProgress(0);
    setError(null);
    window.location.reload();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Monitoreo de Signos Vitales</h1>
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
