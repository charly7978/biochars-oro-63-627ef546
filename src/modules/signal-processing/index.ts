
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Central export point for signal processing
 */

// Export core signal processors
export { PPGSignalProcessor } from './PPGSignalProcessor';
export { HeartbeatProcessor } from './HeartbeatProcessor';

// Export processed signal types
export { ProcessedPPGSignal, ProcessedHeartbeatSignal } from './types';

// Export configuration types
export { SignalProcessingOptions } from './types';

// Export utility functions
export { resetFingerDetector } from './finger-detector';

// Export channels
export { SpecializedChannel } from './channels/SpecializedChannel';
export { GlucoseChannel } from './channels/GlucoseChannel';
export { LipidsChannel } from './channels/LipidsChannel';
export { BloodPressureChannel } from './channels/BloodPressureChannel';
export { SpO2Channel } from './channels/SpO2Channel';
export { CardiacChannel } from './channels/CardiacChannel';

// Export signal distributor
export { OptimizedSignalDistributor } from './OptimizedSignalDistributor';
