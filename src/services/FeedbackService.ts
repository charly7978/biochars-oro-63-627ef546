
/**
 * Servicio centralizado para proporcionar retroalimentación táctil y auditiva
 * Asegura que la vibración siempre funcione cuando se detecta un latido
 */
class FeedbackService {
  /**
   * Activa la vibración del dispositivo
   * @param duration Duración de la vibración en ms
   */
  static vibrate(duration: number = 50): void {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(duration);
        console.log(`FeedbackService: Vibración activada por ${duration}ms`);
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
}

export default FeedbackService;
