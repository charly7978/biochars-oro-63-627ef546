
import React, { useState, useEffect } from 'react';
import './App.css';
import { waitForOpenCV, isOpenCVAvailable } from './opencv/opencv-wrapper';

const App: React.FC = () => {
  const [opencvStatus, setOpencvStatus] = useState<string>('Cargando OpenCV...');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(10);

  useEffect(() => {
    // Verificar OpenCV de forma real sin simulaciones
    const checkOpenCV = async () => {
      try {
        console.log('Intentando cargar OpenCV...');
        setLoadingProgress(30);
        
        // Intentar cargar OpenCV con timeout de 15 segundos
        await waitForOpenCV(15000);
        
        // Verificar directamente si OpenCV está realmente disponible
        if (isOpenCVAvailable() && window.cv && window.cv_ready) {
          setOpencvStatus('¡OpenCV está listo!');
          setIsReady(true);
          setLoadingProgress(100);
          console.log('OpenCV cargado y verificado exitosamente.');
        } else {
          throw new Error('OpenCV no se cargó correctamente');
        }
      } catch (error) {
        console.error('Error al cargar OpenCV:', error);
        setOpencvStatus(`Error al cargar OpenCV. Intente reiniciar la aplicación.`);
      }
    };

    checkOpenCV();
  }, []);

  // Función para reintentar la carga
  const handleRetry = () => {
    setOpencvStatus('Reintentando cargar OpenCV...');
    setLoadingProgress(10);
    window.location.reload();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Monitoreo de Signos Vitales</h1>
        <div className="loading-container">
          <div 
            className="loading-bar" 
            style={{ width: `${loadingProgress}%` }}
          ></div>
        </div>
        <p className="status">{opencvStatus}</p>
        <p>
          {isReady 
            ? "La aplicación está lista para usar."
            : "La aplicación se está iniciando. Por favor espere mientras se cargan los recursos..."}
        </p>
        
        {!isReady && (
          <button 
            onClick={handleRetry}
            className="retry-button"
          >
            Reintentar
          </button>
        )}
      </header>
    </div>
  );
};

export default App;
