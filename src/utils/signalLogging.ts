
/**
 * Signal logging utilities for debugging and monitoring
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * Log signal processing events with different severity levels
 */
export function logSignalProcessing(
  level: LogLevel, 
  source: string, 
  message: string, 
  data?: any
) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    level,
    source,
    message,
    timestamp,
    data
  };
  
  switch (level) {
    case LogLevel.ERROR:
      console.error(`[${source}] ${message}`, data || '');
      break;
    case LogLevel.WARN:
      console.warn(`[${source}] ${message}`, data || '');
      break;
    case LogLevel.INFO:
      console.info(`[${source}] ${message}`, data || '');
      break;
    case LogLevel.DEBUG:
    default:
      console.log(`[${source}] ${message}`, data || '');
      break;
  }
  
  // Add to in-memory log if needed
  addToInMemoryLog(logEntry);
  
  return logEntry;
}

// In-memory log for recent entries
const MAX_LOG_ENTRIES = 1000;
const inMemoryLog: any[] = [];

function addToInMemoryLog(entry: any) {
  inMemoryLog.push(entry);
  if (inMemoryLog.length > MAX_LOG_ENTRIES) {
    inMemoryLog.shift();
  }
}

/**
 * Get all recent log entries
 */
export function getLogEntries() {
  return [...inMemoryLog];
}

/**
 * Clear all log entries
 */
export function clearLogEntries() {
  inMemoryLog.length = 0;
}

/**
 * Track performance metrics for signal processing
 */
export function trackPerformance(label: string, startTime: number) {
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  logSignalProcessing(
    LogLevel.DEBUG, 
    'Performance', 
    `${label} took ${duration.toFixed(2)}ms`
  );
  
  return duration;
}

/**
 * Track performance metrics for async operations
 */
export async function trackPerformanceAsync<T>(
  label: string, 
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await fn();
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    logSignalProcessing(
      LogLevel.DEBUG, 
      'Performance', 
      `Async ${label} took ${duration.toFixed(2)}ms`
    );
    
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    logSignalProcessing(
      LogLevel.ERROR, 
      'Performance', 
      `Async ${label} failed after ${duration.toFixed(2)}ms`,
      error
    );
    
    throw error;
  }
}

/**
 * Get error statistics from log entries
 */
export function getErrorStats(timeWindow: number = 60000) {
  const now = Date.now();
  const cutoff = now - timeWindow;
  
  const recentErrors = inMemoryLog.filter(entry => 
    entry.level === LogLevel.ERROR && 
    new Date(entry.timestamp).getTime() > cutoff
  );
  
  const sourceCounts: Record<string, number> = {};
  recentErrors.forEach(error => {
    sourceCounts[error.source] = (sourceCounts[error.source] || 0) + 1;
  });
  
  return {
    total: recentErrors.length,
    sourceCounts,
    recentErrors: recentErrors.slice(-10) // Last 10 errors
  };
}

/**
 * Realizar un diagnóstico integral del sistema basado en logs
 */
export function performSystemDiagnostics() {
  const now = Date.now();
  
  // Estadísticas de errores por períodos
  const last5MinErrors = getErrorStats(300000); // 5 minutos
  const last30MinErrors = getErrorStats(1800000); // 30 minutos
  const last1HourErrors = getErrorStats(3600000); // 1 hora
  
  // Analizar tendencias (crecimiento/decrecimiento de errores)
  const errorRate5min = last5MinErrors.total / 5;
  const errorRate30min = last30MinErrors.total / 30;
  const errorRateHour = last1HourErrors.total / 60;
  
  // Determinar tendencia
  let trend: 'improving' | 'stable' | 'worsening' = 'stable';
  if (errorRate5min < errorRate30min * 0.7) {
    trend = 'improving';
  } else if (errorRate5min > errorRate30min * 1.3) {
    trend = 'worsening';
  }
  
  // Fuentes más comunes de errores
  const errorSources = Object.entries(last30MinErrors.sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  // Calcular estadísticas generales de logs
  const allLogs = inMemoryLog.slice(-1000);
  const logsByLevel = {
    [LogLevel.DEBUG]: allLogs.filter(log => log.level === LogLevel.DEBUG).length,
    [LogLevel.INFO]: allLogs.filter(log => log.level === LogLevel.INFO).length,
    [LogLevel.WARN]: allLogs.filter(log => log.level === LogLevel.WARN).length,
    [LogLevel.ERROR]: allLogs.filter(log => log.level === LogLevel.ERROR).length,
  };
  
  // Calcular salud del sistema basada en proporción de errores vs logs totales
  const totalLogs = allLogs.length || 1; // Evitar división por cero
  const errorPercentage = (logsByLevel[LogLevel.ERROR] / totalLogs) * 100;
  const warningPercentage = (logsByLevel[LogLevel.WARN] / totalLogs) * 100;
  
  let systemHealth: 'critical' | 'degraded' | 'fair' | 'good' | 'excellent' = 'good';
  
  if (errorPercentage > 10) {
    systemHealth = 'critical';
  } else if (errorPercentage > 5 || warningPercentage > 15) {
    systemHealth = 'degraded';
  } else if (errorPercentage > 1 || warningPercentage > 10) {
    systemHealth = 'fair';
  } else if (errorPercentage === 0 && warningPercentage < 5) {
    systemHealth = 'excellent';
  }
  
  // Verificar recursos del sistema
  const memoryInfo = getMemoryInfo();
  
  // Resultados del diagnóstico
  return {
    timestamp: now,
    errorStats: {
      last5Min: last5MinErrors.total,
      last30Min: last30MinErrors.total,
      lastHour: last1HourErrors.total,
      trend,
      topErrorSources: errorSources
    },
    logStats: logsByLevel,
    systemHealth,
    memoryInfo,
    recommendations: generateRecommendations(
      systemHealth, 
      errorSources, 
      trend,
      memoryInfo
    )
  };
}

/**
 * Obtener información de memoria del sistema
 */
function getMemoryInfo() {
  try {
    if (typeof window !== 'undefined' && (window as any).performance && (window as any).performance.memory) {
      const memoryInfo = (window as any).performance.memory;
      return {
        usedJSHeapSize: formatBytes(memoryInfo.usedJSHeapSize),
        jsHeapSizeLimit: formatBytes(memoryInfo.jsHeapSizeLimit),
        totalJSHeapSize: formatBytes(memoryInfo.totalJSHeapSize),
        memoryUsagePercentage: ((memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100).toFixed(1) + '%'
      };
    }
    
    // Información de memoria de TensorFlow si está disponible
    if (typeof window !== 'undefined' && (window as any).tf) {
      try {
        const tfMemory = (window as any).tf.memory();
        return {
          numTensors: tfMemory.numTensors,
          numDataBuffers: tfMemory.numDataBuffers,
          unreliable: tfMemory.unreliable,
          reasons: tfMemory.reasons
        };
      } catch (e) {
        console.warn('Error al obtener info de memoria TF:', e);
      }
    }
  } catch (e) {
    console.warn('Error al obtener información de memoria:', e);
  }
  
  return {
    unavailable: true,
    message: 'Información de memoria no disponible'
  };
}

/**
 * Formatear bytes a unidades legibles
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generar recomendaciones basadas en el diagnóstico
 */
function generateRecommendations(
  systemHealth: 'critical' | 'degraded' | 'fair' | 'good' | 'excellent',
  errorSources: [string, number][],
  trend: 'improving' | 'stable' | 'worsening',
  memoryInfo: any
): string[] {
  const recommendations: string[] = [];
  
  // Recomendaciones basadas en salud del sistema
  switch (systemHealth) {
    case 'critical':
      recommendations.push('Reiniciar completamente el sistema.');
      recommendations.push('Verificar todos los procesadores y dependencias críticas.');
      break;
    case 'degraded':
      recommendations.push('Reiniciar los módulos problemáticos.');
      recommendations.push('Realizar verificaciones de integridad en los componentes clave.');
      break;
    case 'fair':
      recommendations.push('Monitorear los componentes con advertencias.');
      if (trend === 'worsening') {
        recommendations.push('Considerar reiniciar los módulos con errores recurrentes.');
      }
      break;
    case 'good':
    case 'excellent':
      if (trend === 'worsening') {
        recommendations.push('Vigilar tendencias de error ya que están aumentando.');
      } else {
        recommendations.push('Continuar operación normal, sistema saludable.');
      }
      break;
  }
  
  // Recomendaciones específicas basadas en fuentes de error
  if (errorSources.length > 0) {
    const topSource = errorSources[0][0];
    const topCount = errorSources[0][1];
    
    if (topCount > 10) {
      recommendations.push(`Atención prioritaria al componente "${topSource}" (${topCount} errores)`);
    }
    
    if (topSource.includes('Processor') || topSource.includes('Detection')) {
      recommendations.push(`Reiniciar el procesador "${topSource}"`);
    } else if (topSource.includes('Camera') || topSource.includes('Video')) {
      recommendations.push('Verificar permisos y configuración de cámara');
    } else if (topSource.includes('Network')) {
      recommendations.push('Verificar conexión de red y reintentar operaciones fallidas');
    }
  }
  
  // Recomendaciones basadas en memoria
  if (memoryInfo && !memoryInfo.unavailable) {
    // Si es memoria TensorFlow
    if (memoryInfo.numTensors) {
      if (memoryInfo.numTensors > 1000) {
        recommendations.push(`Liberar tensores no utilizados (${memoryInfo.numTensors} activos)`);
      }
    }
    // Si es memoria JavaScript
    else if (memoryInfo.memoryUsagePercentage) {
      const usagePercent = parseFloat(memoryInfo.memoryUsagePercentage);
      if (usagePercent > 80) {
        recommendations.push(`Reducir uso de memoria (${memoryInfo.memoryUsagePercentage} utilizado)`);
      }
    }
  }
  
  return recommendations;
}

/**
 * Analizar logs para identificar correlaciones entre eventos
 */
export function analyzeLogCorrelations(timeWindow: number = 300000) {
  const now = Date.now();
  const cutoff = now - timeWindow;
  
  const recentLogs = inMemoryLog.filter(entry => 
    new Date(entry.timestamp).getTime() > cutoff
  );
  
  // Agrupar por ventanas de tiempo de 10 segundos
  const timeWindows: Record<string, any[]> = {};
  const windowSize = 10000; // 10 segundos
  
  recentLogs.forEach(log => {
    const timestamp = new Date(log.timestamp).getTime();
    const windowKey = Math.floor((timestamp - cutoff) / windowSize).toString();
    
    if (!timeWindows[windowKey]) {
      timeWindows[windowKey] = [];
    }
    
    timeWindows[windowKey].push(log);
  });
  
  // Buscar correlaciones de eventos
  const correlations: {
    window: string;
    events: {source: string; level: LogLevel}[];
    count: number;
  }[] = [];
  
  Object.entries(timeWindows).forEach(([window, logs]) => {
    if (logs.length >= 3) {
      const sources = new Set(logs.map(log => log.source));
      
      // Si hay varios orígenes en la misma ventana, puede haber correlación
      if (sources.size >= 2) {
        correlations.push({
          window,
          events: logs.map(log => ({
            source: log.source,
            level: log.level
          })),
          count: logs.length
        });
      }
    }
  });
  
  // Ordenar por cantidad de eventos
  correlations.sort((a, b) => b.count - a.count);
  
  return {
    correlations: correlations.slice(0, 5), // Top 5 correlaciones
    timeWindows: Object.keys(timeWindows).length,
    totalLogs: recentLogs.length
  };
}

/**
 * Capacidades avanzadas: Detección de anomalías en patrones de error
 */
export function detectErrorAnomalies() {
  // Obtener estadísticas históricas
  const hourlyStats: number[] = [];
  
  // Generar estadísticas de cada hora en las últimas 24 horas
  for (let i = 0; i < 24; i++) {
    const timeWindow = (i + 1) * 3600000; // i+1 horas en ms
    const stats = getErrorStats(timeWindow);
    hourlyStats.push(stats.total);
  }
  
  // Calcular desviación estándar y media
  const mean = hourlyStats.reduce((sum, val) => sum + val, 0) / hourlyStats.length;
  const variance = hourlyStats.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / hourlyStats.length;
  const stdDev = Math.sqrt(variance);
  
  // Detección de anomalías (valores que exceden 2 desviaciones estándar)
  const latestErrorCount = hourlyStats[0]; // Última hora
  const isAnomaly = Math.abs(latestErrorCount - mean) > 2 * stdDev;
  
  return {
    isAnomaly,
    currentCount: latestErrorCount,
    mean: mean.toFixed(2),
    stdDev: stdDev.toFixed(2),
    threshold: (mean + 2 * stdDev).toFixed(2),
    hourlyStats
  };
}

/**
 * Evalúa la calidad general del sistema
 */
export function evaluateSystemQuality() {
  const diagnostics = performSystemDiagnostics();
  const anomalies = detectErrorAnomalies();
  const correlations = analyzeLogCorrelations();
  
  // Calcular puntuación general (0-100)
  let qualityScore = 100;
  
  // Reducir puntuación basada en salud del sistema
  switch (diagnostics.systemHealth) {
    case 'critical':
      qualityScore -= 50;
      break;
    case 'degraded':
      qualityScore -= 30;
      break;
    case 'fair':
      qualityScore -= 15;
      break;
    case 'good':
      qualityScore -= 5;
      break;
    case 'excellent':
      // No reducción
      break;
  }
  
  // Reducir por anomalías detectadas
  if (anomalies.isAnomaly) {
    qualityScore -= 20;
  }
  
  // Reducir por correlaciones significativas (pueden indicar problemas sistémicos)
  if (correlations.correlations.length > 3) {
    qualityScore -= 10;
  }
  
  // Asegurar que la puntuación esté en rango 0-100
  qualityScore = Math.max(0, Math.min(100, qualityScore));
  
  // Calcular grado de calidad
  let qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  
  if (qualityScore >= 90) qualityGrade = 'A';
  else if (qualityScore >= 80) qualityGrade = 'B';
  else if (qualityScore >= 70) qualityGrade = 'C';
  else if (qualityScore >= 60) qualityGrade = 'D';
  else qualityGrade = 'F';
  
  return {
    score: qualityScore,
    grade: qualityGrade,
    timestamp: Date.now(),
    summary: `El sistema está operando con una calidad grado ${qualityGrade} (${qualityScore}/100)`,
    details: {
      health: diagnostics.systemHealth,
      anomaliesDetected: anomalies.isAnomaly,
      correlationsFound: correlations.correlations.length
    },
    recommendations: diagnostics.recommendations
  };
}
