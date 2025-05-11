
/**
 * Servicio centralizado para proporcionar retroalimentación táctil y auditiva
 * Asegura que la vibración siempre funcione cuando se detecta un latido
 */
class FeedbackService {
  // Control para evitar vibraciones demasiado frecuentes
  private static lastVibration: number = 0;
  private static readonly MIN_VIBRATION_INTERVAL = 250; // ms
  
  /**
   * Activa la vibración del dispositivo de forma optimizada
   * @param duration Duración de la vibración en ms
   */
  static vibrate(duration: number = 50): void {
    try {
      const now = Date.now();
      // Evitar vibraciones demasiado frecuentes
      if (now - this.lastVibration < this.MIN_VIBRATION_INTERVAL) {
        return;
      }
      
      this.lastVibration = now;
      
      if ('vibrate' in navigator) {
        navigator.vibrate(duration);
        console.log(`FeedbackService: Vibración activada por ${duration}ms`, {
          tiempo: new Date().toISOString()
        });
      } else {
        console.log("FeedbackService: Vibración no soportada en este dispositivo");
      }
    } catch (error) {
      console.error("FeedbackService: Error al activar vibración", error);
    }
  }

  /**
   * Activa un sonido de latido
   * @param audioContext Contexto de audio
   * @param type Tipo de latido (normal o arritmia)
   */
  static playHeartbeatSound(audioContext: AudioContext | null, type: 'normal' | 'arrhythmia' = 'normal'): void {
    try {
      if (!audioContext) return;

      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      if (type === 'normal') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, audioContext.currentTime);
        gain.gain.setValueAtTime(0.05, audioContext.currentTime);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, audioContext.currentTime);
        gain.gain.setValueAtTime(0.08, audioContext.currentTime);
      }

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + (type === 'arrhythmia' ? 0.2 : 0.1));

      console.log(`FeedbackService: Sonido de latido ${type} reproducido`);
    } catch (error) {
      console.error("FeedbackService: Error reproduciendo sonido", error);
    }
  }
  
  /**
   * Proporciona retroalimentación completa de latido (vibración y sonido)
   * @param audioContext Contexto de audio opcional
   * @param type Tipo de latido
   */
  static triggerHeartbeat(audioContext: AudioContext | null = null, type: 'normal' | 'arrhythmia' = 'normal'): void {
    // Siempre vibrar, independiente del tipo de latido
    const duration = type === 'normal' ? 50 : 100;
    this.vibrate(duration);
    
    // Reproducir sonido si hay un contexto de audio
    if (audioContext) {
      this.playHeartbeatSound(audioContext, type);
    }
    
    console.log(`FeedbackService: Retroalimentación de latido ${type} activada`, {
      tiempo: new Date().toISOString(),
      conAudio: !!audioContext
    });
  }
}

export default FeedbackService;
