
import React, { useState, useEffect } from 'react';
import './App.css';
import { waitForOpenCV } from './opencv/opencv-wrapper';

const App: React.FC = () => {
  const [opencvStatus, setOpencvStatus] = useState<string>('Cargando OpenCV...');
  const [isReady, setIsReady] = useState<boolean>(false);

  useEffect(() => {
    // Check if OpenCV is loaded
    const checkOpenCV = async () => {
      try {
        await waitForOpenCV();
        setOpencvStatus('¡OpenCV está listo!');
        setIsReady(true);
      } catch (error) {
        setOpencvStatus(`Error al cargar OpenCV: ${error}`);
      }
    };

    checkOpenCV();

    // Fallback in case the event doesn't fire
    const checkInterval = setInterval(() => {
      if (window.cv || window.cv_ready) {
        setOpencvStatus('¡OpenCV está disponible!');
        setIsReady(true);
        clearInterval(checkInterval);
      }
    }, 1000);

    // Cleanup
    return () => {
      clearInterval(checkInterval);
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Monitoreo de Signos Vitales</h1>
        <p className="status">{opencvStatus}</p>
        <p>
          {isReady 
            ? "La aplicación está lista para usar."
            : "La aplicación se está iniciando. Por favor espere mientras se cargan los recursos..."}
        </p>
      </header>
    </div>
  );
};

export default App;
