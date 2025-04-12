/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Importar filtros y utilidades consolidados
import { applyMovingAverageFilter } from '@/core/filters/signalFilters'; // Para SMA
import { amplifySignal as amplifySignalConsolidated } from '@/utils/signalAnalysisUtils'; // Para amplificación

/**
 * Aplica un filtro de Media Móvil Simple (SMA) a datos reales.
 * DEPRECATED: Usar applyMovingAverageFilter de @/core/filters/signalFilters
 */
export function applySMAFilter(value: number, buffer: number[], windowSize: number): {
  filteredValue: number;
  updatedBuffer: number[];
} {
  // Llama a la función consolidada
  console.warn("Deprecated: applySMAFilter in filter-utils.ts. Use applyMovingAverageFilter from @/core/filters/signalFilters.");
  return applyMovingAverageFilter(value, buffer, windowSize);
}

/**
 * Amplifica la señal real de forma adaptativa basada en su amplitud.
 * Sin uso de datos simulados.
 * DEPRECATED: Usar amplifySignal de @/utils/signalAnalysisUtils
 */
export function amplifySignal(value: number, recentValues: number[]): number {
  console.warn("Deprecated: amplifySignal in filter-utils.ts. Use amplifySignal from @/utils/signalAnalysisUtils.");
  // Llama a la función consolidada
  return amplifySignalConsolidated(value, recentValues);
}
