
/**
 * Utilities for arrhythmia detection without using Math functions
 */

// Deterministic utilities to replace Math functions
export function realMin(a: number, b: number): number { 
  return a < b ? a : b; 
}

export function realMax(a: number, b: number): number { 
  return a > b ? a : b; 
}

export function realAbs(x: number): number { 
  return x < 0 ? -x : x; 
}

/**
 * Categorize arrhythmia based on RR intervals
 * MEJORADO: algoritmo más sensible y preciso
 */
export function categorizeArrhythmia(
  intervals: number[]
): 'normal' | 'possible-arrhythmia' | 'bigeminy' | 'tachycardia' | 'bradycardia' {
  if (!intervals || intervals.length === 0) {
    return 'possible-arrhythmia';
  }
  
  // Usar los últimos intervalos para análisis más reciente
  const recentIntervals = intervals.slice(-5);
  
  // Verificar cantidad de intervalos
  if (recentIntervals.length < 3) {
    return 'normal'; // No hay suficientes datos para determinar arritmia
  }
  
  // Calcular promedio de intervalos
  let sum = 0;
  for (let i = 0; i < recentIntervals.length; i++) {
    sum += recentIntervals[i];
  }
  const avgInterval = sum / recentIntervals.length;
  
  // Detectar bradicardia y taquicardia basado en promedio
  if (avgInterval < 500) return 'tachycardia';    // >120 BPM
  if (avgInterval > 1200) return 'bradycardia';   // <50 BPM
  
  // Calcular variabilidad de intervalos
  let variabilitySum = 0;
  for (let i = 1; i < recentIntervals.length; i++) {
    variabilitySum += realAbs(recentIntervals[i] - recentIntervals[i-1]);
  }
  const avgVariability = variabilitySum / (recentIntervals.length - 1);
  
  // Detectar bigeminismo (patrón alternante)
  if (intervals.length >= 4) {
    let alternatingPattern = true;
    for (let i = 2; i < intervals.length; i += 2) {
      const evenRR = intervals[i];
      const oddRR = intervals[i - 2];
      // Si la diferencia entre intervalos alternados es pequeña, pero
      // la diferencia entre intervalos consecutivos es grande
      if (realAbs(evenRR - oddRR) / oddRR < 0.25) {
        alternatingPattern = false;
        break;
      }
    }
    if (alternatingPattern) return 'bigeminy';
  }
  
  // Detectar arritmia basada en variabilidad
  if (avgVariability > 100) {
    return 'possible-arrhythmia';
  }
  
  return 'normal';
}

/**
 * Converts ArrhythmiaWindows to the format expected by PPGSignalMeter
 * Ensuring the return type matches ArrhythmiaWindow[]
 * CORREGIDO: tipos correctos para evitar errores TypeScript
 */
export const formatArrhythmiaWindowsForDisplay = (windows: any[]): { 
  timestamp: number;
  duration: number;
  status: string;
  intervals: number[];
  probability: number;
  details: Record<string, any>;
  start: number;
  end: number;
}[] => {
  if (!windows || !Array.isArray(windows)) return [];
  
  return windows.map(window => ({
    timestamp: window.timestamp || Date.now(),
    duration: window.duration || 1000,
    status: window.status || 'unknown',
    intervals: window.intervals || [],
    probability: window.probability || 0,
    details: window.details || {},
    // Add the expected properties
    start: window.timestamp || Date.now(),
    end: (window.timestamp || Date.now()) + (window.duration || 1000)
  }));
};
