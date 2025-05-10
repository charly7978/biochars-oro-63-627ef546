
/**
 * Utilidades para cálculo y normalización de índices de perfusión
 * Solo procesa datos reales, sin simulación
 */

export const calculatePerfusionIndex = (values: number[]): number => {
  if (values.length < 2) return 0;
  
  const max = Math.max(...values);
  const min = Math.min(...values);
  const ac = max - min;
  const dc = (max + min) / 2;
  
  return dc !== 0 ? (ac / dc) * 100 : 0;
};

export const normalizePerfusion = (perfusionIndex: number): number => {
  // Normalize to 0-1 range, capping at reasonable physiological limits
  const maxNormalPI = 10; // Maximum normal perfusion index
  return Math.min(1, Math.max(0, perfusionIndex / maxNormalPI));
};
