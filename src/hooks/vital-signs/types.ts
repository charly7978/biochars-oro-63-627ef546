
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

export interface ArrhythmiaWindow {
  start: number;
  end: number;
}

export interface ArrhythmiaVisualizationData {
  rrIntervals: number[];
  hrv: number;
  windows: ArrhythmiaWindow[];
  lastUpdateTime: number;
  isArrhythmia: boolean;
}

export interface ArrhythmiaRenderOptions {
  showHRV: boolean;
  showWindows: boolean;
  subtleIndicators: boolean;
  colorCoding: boolean;
}
