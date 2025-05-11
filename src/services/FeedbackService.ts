
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import AudioService from './AudioService';

/**
 * Servicio centralizado para feedback táctil y sonoro
 */
export class FeedbackService {
  private static instance: FeedbackService;
  private audioService: AudioService;
  private vibrationEnabled: boolean = true;
  private audioEnabled: boolean = true;
  private lastVibrationTime: number = 0;
  private MIN_VIBRATION_INTERVAL_MS: number = 350; // Intervalo mínimo entre vibraciones
  
  private constructor() {
    this.audioService = AudioService.getInstance();
  }
  
  /**
   * Obtiene la instancia singleton del servicio
   */
  public static getInstance(): FeedbackService {
    if (!FeedbackService.instance) {
      FeedbackService.instance = new FeedbackService();
    }
    return FeedbackService.instance;
  }
  
  /**
   * Reproduce vibración con patrón personalizado
   */
  public vibrate(pattern?: number | number[]): boolean {
    if (!this.vibrationEnabled) return false;
    
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern || 50);
        return true;
      }
      return false;
    } catch (error) {
      console.error("FeedbackService: Error al vibrar", error);
      return false;
    }
  }
  
  /**
   * Vibración específica para latido cardíaco
   */
  public vibrateHeartbeat(isArrhythmia: boolean = false): boolean {
    const now = Date.now();
    
    // Evitar vibraciones demasiado frecuentes
    if (now - this.lastVibrationTime < this.MIN_VIBRATION_INTERVAL_MS) {
      return false;
    }
    
    const pattern = isArrhythmia ? [30, 20, 70] : [30, 10, 20];
    const success = this.vibrate(pattern);
    
    if (success) {
      this.lastVibrationTime = now;
    }
    
    return success;
  }
  
  /**
   * Vibración específica para arritmia detectada
   */
  public vibrateArrhythmia(): boolean {
    return this.vibrate([40, 30, 80, 50, 60]);
  }
  
  /**
   * Reproduce sonido según tipo
   */
  public playSound(type?: 'success' | 'error' | 'notification' | 'heartbeat'): void {
    if (!this.audioEnabled) return;
    
    switch (type) {
      case 'heartbeat':
        this.audioService.playHeartbeatBeep(false);
        break;
      case 'success':
      case 'error':
      case 'notification':
        this.audioService.playNotificationSound('success'); // Fixed: Using a valid value instead of the type directly
        break;
      default:
        this.audioService.playNotificationSound();
    }
  }
  
  /**
   * Reproduce sonido de latido
   */
  public playHeartbeatSound(isArrhythmia: boolean = false): void {
    if (!this.audioEnabled) return;
    
    this.audioService.playHeartbeatBeep(isArrhythmia);
  }
  
  /**
   * Reproduce sonido de notificación
   */
  public playNotificationSound(type: 'success' | 'error' | 'warning' = 'success'): void {
    if (!this.audioEnabled) return;
    
    this.audioService.playNotificationSound(type);
  }
  
  /**
   * Feedback completo para latido (sonido + vibración)
   */
  public triggerHeartbeatFeedback(isArrhythmia: boolean = false): void {
    this.playHeartbeatSound(isArrhythmia);
    this.vibrateHeartbeat(isArrhythmia);
  }
  
  /**
   * Activar/desactivar vibración
   */
  public setVibrationEnabled(enabled: boolean): void {
    this.vibrationEnabled = enabled;
  }
  
  /**
   * Activar/desactivar audio
   */
  public setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled;
    
    if (enabled) {
      this.audioService.enableAudio();
    } else {
      this.audioService.disableAudio();
    }
  }
  
  /**
   * Verificar si la vibración está disponible
   */
  public isVibrationAvailable(): boolean {
    return 'vibrate' in navigator;
  }
  
  /**
   * Verificar si la vibración está activada
   */
  public isVibrationEnabled(): boolean {
    return this.vibrationEnabled && this.isVibrationAvailable();
  }
  
  /**
   * Verificar si el audio está activado
   */
  public isAudioEnabled(): boolean {
    return this.audioEnabled && this.audioService.isAudioEnabled();
  }
}

export default FeedbackService;
