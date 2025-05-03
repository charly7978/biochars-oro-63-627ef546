
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// This file has been deprecated. 
// All functionality has been consolidated in the main useHeartBeatProcessor hook at src/hooks/useHeartBeatProcessor.ts
// For imports, please use: import { useHeartBeatProcessor } from '@/hooks/useHeartBeatProcessor';

import { useHeartBeatProcessor } from '@/hooks/useHeartBeatProcessor';

// Re-export the consolidated hook for backward compatibility
export const useHeartBeatProcessor = useHeartBeatProcessor;

// Export a warning for any developers still using this import path
console.warn('DEPRECATION WARNING: Please import useHeartBeatProcessor from @/hooks/useHeartBeatProcessor instead');
