
import React, { useState, useEffect } from 'react';
import './App.css';

const App: React.FC = () => {
  const [opencvStatus, setOpencvStatus] = useState<string>('Loading OpenCV...');

  useEffect(() => {
    // Check if OpenCV is loaded
    if (window.cv) {
      setOpencvStatus('OpenCV is available!');
    } else {
      // Listen for OpenCV ready event
      const handleOpenCVReady = () => {
        setOpencvStatus('OpenCV is ready!');
        window.cv_ready = true;
      };

      window.addEventListener('opencv-ready', handleOpenCVReady);

      // Fallback in case the event doesn't fire
      const checkInterval = setInterval(() => {
        if (window.cv) {
          setOpencvStatus('OpenCV is available!');
          window.cv_ready = true;
          clearInterval(checkInterval);
        }
      }, 1000);

      // Cleanup
      return () => {
        window.removeEventListener('opencv-ready', handleOpenCVReady);
        clearInterval(checkInterval);
      };
    }
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Vital Signs Monitoring</h1>
        <p className="status">{opencvStatus}</p>
        <p>
          Application is starting up. Please wait while resources are loading...
        </p>
      </header>
    </div>
  );
};

export default App;
