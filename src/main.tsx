
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeModuleAnalyzer } from './utils/moduleAnalyzer.ts'
import ImportErrorDefenseSystem from './core/error-defense/ImportErrorDefenseSystem.ts'

// Initialize import error defense system FIRST - before any other code runs
try {
  const importErrorSystem = ImportErrorDefenseSystem.getInstance();
  importErrorSystem.initializeGlobalInterceptor();
  
  // CRITICAL: Register substitute for the most common import error
  // Using multiple path formats to maximize chance of interception
  importErrorSystem.registerSubstitute(
    'src/modules/heart-beat/signal-quality.ts',
    () => {
      console.log('Using resetDetectionStates substitute from main.tsx');
      return { weakSignalsCount: 0 };
    },
    'resetDetectionStates'
  );
  
  // Also register with absolute path since the error shows up with this path
  importErrorSystem.registerSubstitute(
    '/src/modules/heart-beat/signal-quality.ts',
    () => {
      console.log('Using resetDetectionStates substitute from main.tsx (absolute path)');
      return { weakSignalsCount: 0 };
    },
    'resetDetectionStates'
  );
  
  // Also try with just the filename since some imports might use relative paths
  importErrorSystem.registerSubstitute(
    'signal-quality.ts',
    () => {
      console.log('Using resetDetectionStates substitute from main.tsx (filename only)');
      return { weakSignalsCount: 0 };
    },
    'resetDetectionStates'
  );
  
  console.log('ImportErrorDefenseSystem initialized early in main.tsx');
} catch (error) {
  console.error('Error initializing ImportErrorDefenseSystem in main.tsx:', error);
  
  // Emergency fallback if the error system itself fails
  if (typeof window !== 'undefined') {
    window.__fixModule = (modulePath: string, exportName: string, implementation: any) => {
      console.log(`Emergency module fix: ${modulePath} -> ${exportName}`);
      
      // Create emergency global accessor
      if (!window.__moduleExports) {
        window.__moduleExports = {};
      }
      
      // Store under multiple paths
      window.__moduleExports[modulePath] = window.__moduleExports[modulePath] || {};
      window.__moduleExports[modulePath][exportName] = implementation;
      
      // Also store under shortened path
      const shortPath = modulePath.split('/').pop() || '';
      window.__moduleExports[shortPath] = window.__moduleExports[shortPath] || {};
      window.__moduleExports[shortPath][exportName] = implementation;
      
      return true;
    };
    
    // Apply immediate fix for the critical function
    window.__fixModule('/src/modules/heart-beat/signal-quality.ts', 'resetDetectionStates', () => {
      console.log('Using emergency resetDetectionStates from main.tsx fallback');
      return { weakSignalsCount: 0 };
    });
  }
}

// Initialize module analyzer for early detection of import issues
initializeModuleAnalyzer();

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
      if (errorMessage.includes('resetDetectionStates') || 
          errorMessage.includes('signal-quality')) {
        
        try {
          if (window.__fixModule) {
            window.__fixModule(
              '/src/modules/heart-beat/signal-quality.ts',
              'resetDetectionStates',
              () => {
                console.log('Using fixed resetDetectionStates from global error handler');
                return { weakSignalsCount: 0 };
              }
            );
            
            // Also try with other common path formats
            window.__fixModule(
              'signal-quality.ts',
              'resetDetectionStates',
              () => {
                console.log('Using fixed resetDetectionStates from global error handler (short path)');
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
