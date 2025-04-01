
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 *
 * Exports for signal processing module
 */

// Export classes, types and interfaces
export { PPGSignalProcessor } from './PPGSignalProcessor';
export { HeartbeatProcessor } from './HeartbeatProcessor';
export type { ProcessedPPGSignal, ProcessedHeartbeatSignal, SignalProcessingOptions } from './types';
export { resetFingerDetector } from './utils/finger-detection';

// Export signal channel-related components
export { OptimizedSignalDistributor } from './OptimizedSignalDistributor';

// Export channel types
export { VitalSignType } from '../../types/signal';
export type { ChannelFeedback, OptimizedSignalChannel } from '../../types/signal';

// Export specialized channels
export { GlucoseChannel } from './channels/GlucoseChannel';
export { LipidsChannel } from './channels/LipidsChannel';
export { BloodPressureChannel } from './channels/BloodPressureChannel';
export { SpO2Channel } from './channels/SpO2Channel';
export { CardiacChannel } from './channels/CardiacChannel';
export { SpecializedChannel } from './channels/SpecializedChannel';
