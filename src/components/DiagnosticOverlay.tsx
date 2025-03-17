
import React, { useState, useEffect } from 'react';

interface DiagnosticOverlayProps {
  isMonitoring: boolean;
  lastSignal: any;
  heartRate: number;
  signalQuality: number;
}

export default function DiagnosticOverlay({ 
  isMonitoring, 
  lastSignal, 
  heartRate,
  signalQuality 
}: DiagnosticOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  
  // Toggle visibility on triple tap
  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };
  
  // Capture console logs
  useEffect(() => {
    if (!isVisible) return;
    
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    const captureLog = (type: string, ...args: any[]) => {
      try {
        const message = `${type}: ${args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')}`;
        
        setLogMessages(prev => [message, ...prev].slice(0, 10));
        
        if (type === 'log') return originalLog(...args);
        if (type === 'error') return originalError(...args);
        if (type === 'warn') return originalWarn(...args);
      } catch (e) {
        originalError("Error in log capture:", e);
      }
    };
    
    console.log = (...args) => captureLog('log', ...args);
    console.error = (...args) => captureLog('error', ...args);
    console.warn = (...args) => captureLog('warn', ...args);
    
    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, [isVisible]);
  
  if (!isVisible) {
    return (
      <div 
        className="fixed bottom-1 right-1 w-6 h-6 bg-gray-800/50 rounded-full z-50"
        onTouchStart={toggleVisibility}
        onClick={toggleVisibility}
      />
    );
  }
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-auto p-4 text-white text-xs">
      <button 
        className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded"
        onClick={toggleVisibility}
      >
        Close
      </button>
      
      <h2 className="text-lg font-bold mb-2">Diagnostic Information</h2>
      
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-gray-800 p-2 rounded">
          <h3 className="font-bold">Status</h3>
          <p>Monitoring: {isMonitoring ? 'Yes' : 'No'}</p>
          <p>Finger Detected: {lastSignal?.fingerDetected ? 'Yes' : 'No'}</p>
          <p>Signal Quality: {signalQuality}</p>
          <p>Heart Rate: {heartRate}</p>
        </div>
        
        <div className="bg-gray-800 p-2 rounded">
          <h3 className="font-bold">Signal Data</h3>
          <p>Raw Value: {lastSignal?.rawValue?.toFixed(2) || 'N/A'}</p>
          <p>Filtered Value: {lastSignal?.filteredValue?.toFixed(4) || 'N/A'}</p>
          <p>Perfusion Index: {lastSignal?.perfusionIndex?.toFixed(4) || 'N/A'}</p>
          <p>Timestamp: {lastSignal?.timestamp ? new Date(lastSignal.timestamp).toISOString().substr(11, 8) : 'N/A'}</p>
        </div>
      </div>
      
      <div className="bg-gray-800 p-2 rounded">
        <h3 className="font-bold mb-1">Recent Logs</h3>
        <div className="h-60 overflow-auto text-[10px] leading-tight font-mono">
          {logMessages.map((msg, i) => (
            <div 
              key={i} 
              className={`p-1 ${msg.includes('error') ? 'text-red-400' : 
                msg.includes('warn') ? 'text-yellow-400' : 'text-gray-300'}`}
            >
              {msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
