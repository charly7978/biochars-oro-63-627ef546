
/**
 * Application entry point
 * Initializes the application and renders the root component
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Initialize core modules
import './modules/camera/CameraModule';
import './modules/signal-extraction/PPGSignalExtractor';
import './modules/signal-extraction/HeartBeatExtractor';
import './modules/signal-processing/VitalSignsProcessor';
import './modules/optimization/SignalOptimizer';
import './modules/results/MeasurementManager';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
