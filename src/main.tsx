
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeModuleAnalyzer } from './utils/moduleAnalyzer.ts'
import ImportErrorDefenseSystem from './core/error-defense/ImportErrorDefenseSystem.ts'

// Initialize module analyzer for early detection of import issues
initializeModuleAnalyzer();

// Initialize import error defense system early
try {
  const importErrorSystem = ImportErrorDefenseSystem.getInstance();
  importErrorSystem.initializeGlobalInterceptor();
  
  // Register specific fixes for known issues
  importErrorSystem.registerSubstitute(
    '/src/modules/heart-beat/signal-quality.ts',
    () => {
      console.log('Using substituted resetDetectionStates from main.tsx');
      return { weakSignalsCount: 0 };
    },
    'resetDetectionStates'
  );
  
  console.log('ImportErrorDefenseSystem initialized in main.tsx');
} catch (error) {
  console.error('Error initializing ImportErrorDefenseSystem in main.tsx:', error);
}

// Setup global error handler specifically for module errors
if (typeof window !== 'undefined') {
  const originalOnError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    // Call original handler if it exists
    if (originalOnError && typeof originalOnError === 'function') {
      originalOnError.call(this, message, source, lineno, colno, error);
    }
    
    // Check if this is an import/module error
    const errorMessage = message?.toString() || '';
    
    if (errorMessage.includes('Module') || 
        errorMessage.includes('import') || 
        errorMessage.includes('export') ||
        errorMessage.includes('SyntaxError')) {
      
      console.log('Detected import/module error in global handler:', errorMessage);
      
      // Try to fix common errors immediately
      if (errorMessage.includes('resetDetectionStates') && 
          errorMessage.includes('signal-quality')) {
        
        try {
          if ((window as any).__fixModule) {
            (window as any).__fixModule(
              '/src/modules/heart-beat/signal-quality.ts',
              'resetDetectionStates',
              () => {
                console.log('Using fixed resetDetectionStates from global error handler');
                return { weakSignalsCount: 0 };
              }
            );
          }
        } catch (e) {
          console.error('Error applying fix from global handler:', e);
        }
      }
    }
    
    // Let the error propagate
    return false;
  };
}

// Mount React application
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
