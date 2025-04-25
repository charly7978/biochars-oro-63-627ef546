
import { PeakData } from '@/types/peak';

class AudioFeedbackService {
  private static instance: AudioFeedbackService;
  private audioContext: AudioContext | null = null;
  private lastTriggerTime: number = 0;
  private readonly MIN_TRIGGER_INTERVAL_MS: number = 250;
  private pendingPeaks: PeakData[] = [];
  
  // Audio settings
  private readonly NORMAL_BEEP_FREQUENCY: number = 880;
  private readonly ARRHYTHMIA_BEEP_FREQUENCY: number = 440;
  private readonly NORMAL_BEEP_DURATION_MS: number = 100;
  private readonly ARRHYTHMIA_BEEP_DURATION_MS: number = 200;
  private processingQueue: boolean = false;

  private constructor() {
    this.initAudioContext();
    console.log("AudioFeedbackService: Instance created (singleton)");
  }

  public static getInstance(): AudioFeedbackService {
    if (!AudioFeedbackService.instance) {
      AudioFeedbackService.instance = new AudioFeedbackService();
    }
    return AudioFeedbackService.instance;
  }

  private async initAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log("AudioFeedbackService: Audio context initialized successfully");
    } catch (error) {
      console.error("AudioFeedbackService: Error initializing audio context:", error);
    }
  }

  public queuePeak(peakData: PeakData): void {
    const now = Date.now();
    
    // Evitar colas de reproducción demasiado grandes
    if (this.pendingPeaks.length > 5) {
      this.pendingPeaks = this.pendingPeaks.slice(-2);
    }
    
    // Solo encolar picos recientes
    const MAX_PEAK_AGE_MS = 800;
    if (now - peakData.timestamp < MAX_PEAK_AGE_MS) {
      console.log("AudioFeedbackService: Peak queued", {
        timestamp: new Date(peakData.timestamp).toISOString(),
        isArrhythmia: peakData.isArrhythmia,
        pendingCount: this.pendingPeaks.length
      });
      
      this.pendingPeaks.push(peakData);
      
      if (!this.processingQueue) {
        this.processPendingPeaks();
      }
    }
  }

  private async processPendingPeaks(): Promise<void> {
    this.processingQueue = true;
    
    try {
      if (!this.pendingPeaks.length) {
        this.processingQueue = false;
        return;
      }

      const now = Date.now();
      if (now - this.lastTriggerTime < this.MIN_TRIGGER_INTERVAL_MS) {
        setTimeout(() => this.processPendingPeaks(), this.MIN_TRIGGER_INTERVAL_MS);
        return;
      }

      const peak = this.pendingPeaks[0];
      const timeSincePeak = now - peak.timestamp;

      // Solo reproducir picos que sean recientes
      if (timeSincePeak <= 500) {
        await this.playBeep(peak.isArrhythmia ? 'arrhythmia' : 'normal');
        this.lastTriggerTime = now;
      }

      this.pendingPeaks.shift();
      
      // Procesar siguiente pico si el tiempo ha pasado
      if (this.pendingPeaks.length) {
        setTimeout(() => this.processPendingPeaks(), this.MIN_TRIGGER_INTERVAL_MS);
      } else {
        this.processingQueue = false;
      }
    } catch (error) {
      console.error("AudioFeedbackService: Error processing peaks:", error);
      this.processingQueue = false;
    }
  }

  // Método para compatibilidad con código existente
  public triggerHeartbeatFeedback(type: 'normal' | 'arrhythmia' = 'normal', volume: number = 0.7): boolean {
    const peakData: PeakData = {
      timestamp: Date.now(),
      value: volume,
      isArrhythmia: type === 'arrhythmia'
    };
    this.queuePeak(peakData);
    return true;
  }

  public async playBeep(type: 'normal' | 'arrhythmia' = 'normal', volume: number = 0.7): Promise<boolean> {
    if (!this.audioContext) {
      await this.initAudioContext();
      if (!this.audioContext) return false;
    }

    try {
      if (this.audioContext.state !== 'running') {
        await this.audioContext.resume();
      }

      const frequency = type === 'arrhythmia' ? this.ARRHYTHMIA_BEEP_FREQUENCY : this.NORMAL_BEEP_FREQUENCY;
      const duration = type === 'arrhythmia' ? this.ARRHYTHMIA_BEEP_DURATION_MS : this.NORMAL_BEEP_DURATION_MS;

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = type === 'arrhythmia' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration / 1000);

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration / 1000 + 0.02);
      
      console.log(`AudioFeedbackService: Playing ${type} beep`);

      return true;
    } catch (error) {
      console.error("AudioFeedbackService: Error playing beep:", error);
      return false;
    }
  }

  public cleanUp(): void {
    this.pendingPeaks = [];
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(err => {
        console.error('Error closing audio context:', err);
      });
      this.audioContext = null;
    }
  }
}

export default AudioFeedbackService.getInstance();
