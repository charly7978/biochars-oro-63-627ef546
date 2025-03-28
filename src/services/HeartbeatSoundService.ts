
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
  private initCount = 0;

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
      this.initCount++;
      console.log(`HeartbeatSoundService: Initializing audio context (attempt ${this.initCount})`);
      
      // Si ya tenemos un contexto, intentamos usarlo primero
      if (this.audioContext) {
        if (this.audioContext.state === 'suspended') {
          try {
            await this.audioContext.resume();
            console.log("HeartbeatSoundService: Resumed existing audio context:", this.audioContext.state);
            
            // Si el contexto se reanuda, reproducir beep de prueba 
            await this.playTestBeep(0.3);
            this.isInitialized = true;
            return true;
          } catch (err) {
            console.error("HeartbeatSoundService: Failed to resume existing context, creating new one:", err);
            // Si falla, cerramos el existente e intentamos crear uno nuevo
            this.audioContext.close().catch(e => console.warn("Error closing audio context:", e));
            this.audioContext = null;
          }
        } else if (this.audioContext.state === 'running') {
          console.log("HeartbeatSoundService: Audio context already running");
          this.isInitialized = true;
          return true;
        }
      }
      
      // Crear un nuevo contexto
      console.log("HeartbeatSoundService: Creating fresh AudioContext");
      // Forzar la creación con una interacción de usuario simulada
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      console.log("HeartbeatSoundService: New audio context created, state:", this.audioContext.state);
      
      // Intentar reanudar el contexto inmediatamente
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
          console.log("HeartbeatSoundService: Resumed new audio context:", this.audioContext.state);
        } catch (err) {
          console.warn("HeartbeatSoundService: Error resuming new context (will try on user interaction):", err);
        }
      }
      
      // Beep de prueba audible para verificar que funciona
      await this.playTestBeep(0.3);
      
      this.isInitialized = true;
      console.log("HeartbeatSoundService: Audio Context Fully Initialized, state:", this.audioContext.state);
      return true;
    } catch (err) {
      console.error("HeartbeatSoundService: Critical error initializing audio", err);
      this.isInitialized = false;
      return false;
    }
  }
  
  /**
   * Reproduce un beep de prueba audible para inicializar y probar el audio
   */
  private async playTestBeep(volume = 0.1): Promise<void> {
    if (!this.audioContext) {
      console.error("HeartbeatSoundService: No audio context for test beep");
      return;
    }
    
    try {
      console.log("HeartbeatSoundService: Playing test beep with volume", volume);
      const testOscillator = this.audioContext.createOscillator();
      const testGain = this.audioContext.createGain();
      
      testOscillator.type = "sine";
      testOscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
      
      testGain.gain.setValueAtTime(volume, this.audioContext.currentTime); 
      
      testOscillator.connect(testGain);
      testGain.connect(this.audioContext.destination);
      
      testOscillator.start();
      testOscillator.stop(this.audioContext.currentTime + 0.2);
      
      console.log("HeartbeatSoundService: Test beep played");
      return new Promise(resolve => setTimeout(resolve, 250));
    } catch (e) {
      console.error("HeartbeatSoundService: Error playing test beep", e);
    }
  }

  /**
   * Reproduce un beep para el latido cardíaco con control de volumen
   */
  public async playBeep(volume = 0.7): Promise<void> {
    console.log("HeartbeatSoundService: playBeep called with volume", volume);
    
    const now = Date.now();
    
    // Limitar la frecuencia de reproducción
    if (now - this.lastPlayTime < this.MIN_PLAY_INTERVAL) {
      console.log("HeartbeatSoundService: Ignoring beep, too soon after last one");
      return;
    }
    
    this.lastPlayTime = now;
    
    if (!this.isInitialized || !this.audioContext) {
      console.log("HeartbeatSoundService: Auto-initializing before playing sound");
      const success = await this.initialize();
      if (!success || !this.audioContext) {
        console.error("HeartbeatSoundService: Failed to initialize audio context for playBeep");
        return;
      }
    }
    
    // Si el contexto está suspendido, intentar reanudarlo
    if (this.audioContext.state === 'suspended') {
      try {
        console.log("HeartbeatSoundService: Resuming suspended audio context for playBeep");
        await this.audioContext.resume();
        console.log("HeartbeatSoundService: Audio context resumed:", this.audioContext.state);
      } catch (e) {
        console.error("HeartbeatSoundService: Failed to resume audio context for playBeep", e);
        return;
      }
    }

    if (this.audioContext.state !== 'running') {
      console.error("HeartbeatSoundService: Audio context not running, state:", this.audioContext.state);
      return;
    }

    try {
      console.log("HeartbeatSoundService: Creating heartbeat sound with volume:", volume);
      
      const ctx = this.audioContext;
      
      // Usar volumen más alto para asegurar que se escuche
      const actualVolume = Math.min(1.0, volume * 1.5);
      
      // Crear múltiples osciladores para un sonido más rico
      const primaryOscillator = ctx.createOscillator();
      const primaryGain = ctx.createGain();
      
      const secondaryOscillator = ctx.createOscillator();
      const secondaryGain = ctx.createGain();
      
      const thirdOscillator = ctx.createOscillator();
      const thirdGain = ctx.createGain();

      // Configurar osciladores
      primaryOscillator.type = "sine";
      primaryOscillator.frequency.setValueAtTime(880, ctx.currentTime);

      secondaryOscillator.type = "sine";
      secondaryOscillator.frequency.setValueAtTime(440, ctx.currentTime);
      
      thirdOscillator.type = "triangle";
      thirdOscillator.frequency.setValueAtTime(220, ctx.currentTime);

      // Configurar nodos de ganancia con ataque más fuerte
      primaryGain.gain.setValueAtTime(0, ctx.currentTime);
      primaryGain.gain.linearRampToValueAtTime(
        actualVolume,
        ctx.currentTime + 0.01
      );
      primaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + 0.15
      );

      secondaryGain.gain.setValueAtTime(0, ctx.currentTime);
      secondaryGain.gain.linearRampToValueAtTime(
        actualVolume * 0.6,
        ctx.currentTime + 0.01
      );
      secondaryGain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + 0.2
      );
      
      thirdGain.gain.setValueAtTime(0, ctx.currentTime);
      thirdGain.gain.linearRampToValueAtTime(
        actualVolume * 0.3,
        ctx.currentTime + 0.005
      );
      thirdGain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + 0.25
      );

      // Conectar nodos de audio
      primaryOscillator.connect(primaryGain);
      secondaryOscillator.connect(secondaryGain);
      thirdOscillator.connect(thirdGain);
      
      primaryGain.connect(ctx.destination);
      secondaryGain.connect(ctx.destination);
      thirdGain.connect(ctx.destination);

      // Iniciar y detener osciladores
      primaryOscillator.start(ctx.currentTime);
      secondaryOscillator.start(ctx.currentTime);
      thirdOscillator.start(ctx.currentTime);
      
      primaryOscillator.stop(ctx.currentTime + 0.3);
      secondaryOscillator.stop(ctx.currentTime + 0.3);
      thirdOscillator.stop(ctx.currentTime + 0.3);
      
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
        console.log("HeartbeatSoundService: No audio context, initializing");
        return await this.initialize();
      }
      
      if (this.audioContext.state === 'suspended') {
        console.log("HeartbeatSoundService: Trying to resume audio context");
        try {
          await this.audioContext.resume();
          console.log("HeartbeatSoundService: Audio context resumed, state:", this.audioContext.state);
        } catch (e) {
          console.error("HeartbeatSoundService: Failed to resume audio context", e);
          
          // Crear un nuevo contexto como último recurso
          try {
            this.audioContext.close().catch(e => console.warn("Error closing audio context:", e));
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            console.log("HeartbeatSoundService: Created replacement audio context, state:", this.audioContext.state);
          } catch (err) {
            console.error("HeartbeatSoundService: Failed to create replacement audio context", err);
            return false;
          }
        }
      }
      
      // Intentar reproducir un sonido de prueba audible para confirmar
      await this.playTestBeep(0.2);
      
      this.isInitialized = true;
      return true;
    } catch (e) {
      console.error("HeartbeatSoundService: Error checking audio", e);
      return false;
    }
  }
  
  /**
   * Método para forzar la reproducción de un sonido fuerte para depuración
   */
  public async playDebugSound(): Promise<void> {
    console.log("HeartbeatSoundService: Playing DEBUG sound");
    try {
      // Intentar inicializar si es necesario
      if (!this.isInitialized || !this.audioContext) {
        await this.initialize();
      }
      
      // Reproducir un beep fuerte
      await this.playTestBeep(0.8);
      
      // Luego reproducir el sonido normal
      await this.playBeep(1.0);
      
      console.log("HeartbeatSoundService: DEBUG sound sequence completed");
    } catch (e) {
      console.error("HeartbeatSoundService: Error playing debug sound", e);
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
    playDebugSound?: () => void;
  }
}

// Inicializar la función global con mensajes de diagnóstico
window.playHeartbeatSound = () => {
  console.log("Global playHeartbeatSound function called");
  heartbeatSound.playBeep(0.9).then(() => {
    console.log("Heartbeat sound play attempt completed");
  });
};

// Función de debug adicional para forzar el sonido
window.playDebugSound = () => {
  console.log("Global DEBUG sound function called");
  heartbeatSound.playDebugSound().then(() => {
    console.log("Debug sound sequence completed");
  });
};

// Intentar inicializar inmediatamente
heartbeatSound.initialize().then(success => {
  console.log("Initial heartbeat sound service initialization:", success ? "SUCCESS" : "FAILED");
});

export { heartbeatSound };
