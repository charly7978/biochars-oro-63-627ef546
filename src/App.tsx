
import React, { useState, useEffect } from 'react';
import './App.css';
import { waitForOpenCV } from './opencv/opencv-wrapper';

const App: React.FC = () => {
  const [opencvStatus, setOpencvStatus] = useState<string>('Cargando OpenCV...');
  const [isReady, setIsReady] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);

  useEffect(() => {
    let progressInterval: ReturnType<typeof setInterval>;
    
    // Simulate loading progress
    progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        const newProgress = prev + (1 + Math.floor((Math.random() * 5)));
        return newProgress > 90 ? 90 : newProgress;
      });
    }, 300);

    // Check if OpenCV is loaded
    const checkOpenCV = async () => {
      try {
        console.log('Intentando cargar OpenCV...');
        
        // Longer timeout for initial load (10 seconds)
        await waitForOpenCV(10000);
        
        setOpencvStatus('¡OpenCV está listo!');
        setIsReady(true);
        setLoadingProgress(100);
        clearInterval(progressInterval);
        
      } catch (error) {
        setOpencvStatus(`Error al cargar OpenCV: ${error}`);
        clearInterval(progressInterval);
      }
    };

    checkOpenCV();

    // Cleanup
    return () => {
      clearInterval(progressInterval);
    };
  }, []);

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
            onClick={() => window.location.reload()}
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
