
import { useState, useCallback } from 'react';
import { VitalSignsResult } from '../../types/vital-signs';

// Define log entry type
interface LogEntry {
  timestamp: number;
  signalValue: number;
  result: VitalSignsResult;
  processedCount: number;
}

export const useVitalSignsLogging = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Add a log entry
  const logSignalData = useCallback((signalValue: number, result: VitalSignsResult, processedCount: number) => {
    const newEntry: LogEntry = {
      timestamp: Date.now(),
      signalValue,
      result,
      processedCount
    };
    
    setLogs(prev => {
      const updated = [...prev, newEntry];
      // Limit log size to prevent memory issues
      if (updated.length > 1000) {
        return updated.slice(-1000);
      }
      return updated;
    });
  }, []);
  
  // Clear all logs
  const clearLog = useCallback(() => {
    setLogs([]);
  }, []);
  
  // Get all logs
  const getLogs = useCallback(() => {
    return logs;
  }, [logs]);
  
  // Get recent logs within a specific time window
  const getRecentLogs = useCallback((timeWindowMs: number = 5000) => {
    const cutoffTime = Date.now() - timeWindowMs;
    return logs.filter(log => log.timestamp >= cutoffTime);
  }, [logs]);
  
  return {
    logSignalData,
    clearLog,
    getLogs,
    getRecentLogs
  };
};
