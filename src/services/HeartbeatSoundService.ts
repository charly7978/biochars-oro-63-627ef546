
/**
 * HeartbeatSoundService.ts
 * Servicio dedicado para manejar el audio del latido cardíaco,
 * separando esta responsabilidad de los componentes visuales.
 */

class HeartbeatSoundService {
  private static instance: HeartbeatSoundService;
  private audioContext: AudioContext | null = null;
  private isInitialized: boolean = false;

  private constructor() {
    // Constructor privado para singleton
  }

  /**
   * Obtiene la instancia única del servicio de sonido
   */
  public static getInstance(): HeartbeatSoundService {
    if (!HeartbeatSoundService.instance) {
      HeartbeatSoundService.instance = new HeartbeatSoundService();
    }
    return HeartbeatSoundService.instance;
  }

  /**
   * Inicializa el contexto de audio
   */
  public async initialize(): Promise<boolean> {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
        await this.audioContext.resume();
        // Beep de prueba con volumen muy bajo para inicializar
        await this.playBeep(0.01);
        console.log("HeartbeatSoundService: Audio Context Initialized");
        this.isInitialized = true;
      }
      return true;
    } catch (err) {
      console.error("HeartbeatSoundService: Error initializing audio", err);
      return false;
    }
  }

  /**
   * Reproduce un beep para el latido cardíaco
   */
  public async playBeep(volume = 0.7): Promise<void> {
    if (!this.isInitialized) {
      const success = await this.initialize();
      if (!success || !this.audioContext) return;
    }

    try {
      const ctx = this.audioContext;
      
      const primaryOscillator = ctx.createOscillator();
      const primaryGain = ctx.createGain();
      
      const secondaryOscillator = ctx.createOscillator();
      const secondaryGain = ctx.createGain();

      // Configurar osciladores
      primaryOscillator.type = "sine";
      primaryOscillator.frequency.setValueAtTime(
        880, // Frecuencia primaria (Hz)
        ctx.currentTime
      );

      secondaryOscillator.type = "sine";
      secondaryOscillator.frequency.setValueAtTime(
        440, // Frecuencia secundaria (Hz)
        ctx.currentTime
      );

      // Configurar nodos de ganancia con ataque rápido para timing preciso
      primaryGain.gain.setValueAtTime(0, ctx.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        volume,
        ctx.currentTime + 0.005
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + 0.1 // Duración corta para timing preciso
      );

      secondaryGain.gain.setValueAtTime(0, ctx.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        volume * 0.3,
        ctx.currentTime + 0.005
      );
      secondaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + 0.1 // Duración corta para timing preciso
      );

      // Conectar nodos de audio
      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      primaryGain.connect(ctx.destination);
      secondaryGain.connect(ctx.destination);

      // Iniciar y detener osciladores
      primaryOscillator.start();
      secondaryOscillator.start();
      primaryOscillator.stop(ctx.currentTime + 0.15);
      secondaryOscillator.stop(ctx.currentTime + 0.15);
      
      console.log("HeartbeatSoundService: Beep played at", new Date().toISOString());
    } catch (err) {
      console.error("HeartbeatSoundService: Error playing beep", err);
    }
  }
}

// Exponer un singleton global para acceder desde cualquier parte
const heartbeatSound = HeartbeatSoundService.getInstance();

// Exportar como default el singleton para uso en imports
export default heartbeatSound;

// También exponer una función global para que pueda ser llamada desde cualquier componente
// sin necesidad de importar el servicio
declare global {
  interface Window {
    playHeartbeatSound?: () => void;
  }
}

// Inicializar la función global
window.playHeartbeatSound = () => {
  heartbeatSound.playBeep(0.7);
};

export { heartbeatSound };
