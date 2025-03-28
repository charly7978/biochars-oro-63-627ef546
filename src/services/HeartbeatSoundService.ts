
/**
 * HeartbeatSoundService.ts
 * Servicio dedicado para manejar el audio del latido cardíaco,
 * separando esta responsabilidad de los componentes visuales.
 */

class HeartbeatSoundService {
  private static instance: HeartbeatSoundService;
  private audioContext: AudioContext | null = null;
  private isInitialized: boolean = false;
  private lastPlayTime: number = 0;
  private readonly MIN_PLAY_INTERVAL = 300; // Mínimo intervalo entre sonidos en ms

  private constructor() {
    // Constructor privado para singleton
    console.log("HeartbeatSoundService: Constructor called");
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
      console.log("HeartbeatSoundService: Initializing audio context");
      
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Intentar reanudar el contexto inmediatamente
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
          console.log("HeartbeatSoundService: Audio context resumed from suspended state");
        }
        
        // Beep de prueba con volumen muy bajo para inicializar
        await this.playTestBeep();
        console.log("HeartbeatSoundService: Audio Context Initialized, state:", this.audioContext.state);
      } else if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log("HeartbeatSoundService: Existing audio context resumed from suspended state");
      }
      
      this.isInitialized = true;
      return true;
    } catch (err) {
      console.error("HeartbeatSoundService: Error initializing audio", err);
      this.isInitialized = false;
      return false;
    }
  }
  
  /**
   * Reproduce un beep de prueba con volumen muy bajo para inicializar
   */
  private async playTestBeep(): Promise<void> {
    if (!this.audioContext) return;
    
    try {
      const testOscillator = this.audioContext.createOscillator();
      const testGain = this.audioContext.createGain();
      
      testOscillator.type = "sine";
      testOscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
      
      testGain.gain.setValueAtTime(0.01, this.audioContext.currentTime); // Volumen muy bajo
      
      testOscillator.connect(testGain);
      testGain.connect(this.audioContext.destination);
      
      testOscillator.start();
      testOscillator.stop(this.audioContext.currentTime + 0.1);
      
      console.log("HeartbeatSoundService: Test beep played");
    } catch (e) {
      console.error("HeartbeatSoundService: Error playing test beep", e);
    }
  }

  /**
   * Reproduce un beep para el latido cardíaco
   */
  public async playBeep(volume = 0.7): Promise<void> {
    const now = Date.now();
    
    // Limitar la frecuencia de reproducción
    if (now - this.lastPlayTime < this.MIN_PLAY_INTERVAL) {
      console.log("HeartbeatSoundService: Ignoring beep, too soon after last one");
      return;
    }
    
    this.lastPlayTime = now;
    
    if (!this.isInitialized || !this.audioContext) {
      console.log("HeartbeatSoundService: Attempting to initialize before playing");
      const success = await this.initialize();
      if (!success || !this.audioContext) {
        console.error("HeartbeatSoundService: Failed to initialize audio context");
        return;
      }
    }
    
    // Si el contexto está suspendido, intentar reanudarlo
    if (this.audioContext.state === 'suspended') {
      try {
        console.log("HeartbeatSoundService: Resuming suspended audio context");
        await this.audioContext.resume();
      } catch (e) {
        console.error("HeartbeatSoundService: Failed to resume audio context", e);
        return;
      }
    }

    try {
      console.log("HeartbeatSoundService: Playing heartbeat sound with volume:", volume);
      
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
  
  /**
   * Verificar el estado del audio y reproducir un sonido de prueba
   */
  public async checkAndFixAudio(): Promise<boolean> {
    console.log("HeartbeatSoundService: Checking and fixing audio state");
    
    try {
      if (!this.audioContext) {
        return await this.initialize();
      }
      
      if (this.audioContext.state === 'suspended') {
        console.log("HeartbeatSoundService: Trying to resume audio context");
        await this.audioContext.resume();
      }
      
      // Intentar reproducir un sonido de prueba para confirmar
      await this.playTestBeep();
      
      this.isInitialized = true;
      return true;
    } catch (e) {
      console.error("HeartbeatSoundService: Error checking audio", e);
      return false;
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

// Inicializar la función global con mensajes de diagnóstico
window.playHeartbeatSound = () => {
  console.log("Global playHeartbeatSound function called");
  heartbeatSound.playBeep(0.7).then(() => {
    console.log("Heartbeat sound play attempt completed");
  });
};

export { heartbeatSound };
