/**
 * Centralized service for audio and haptic feedback
 * Only uses real data - no simulation
 */

import { HeartbeatFeedbackType } from "@/hooks/useHeartbeatFeedback";

class AudioFeedbackService {
  private static instance: AudioFeedbackService;
  private audioContext: AudioContext | null = null;
  private lastTriggerTime: number = 0;
  private readonly MIN_TRIGGER_INTERVAL_MS: number = 150;
  
  // Audio settings
  private readonly NORMAL_BEEP_FREQUENCY: number = 880;
  private readonly ARRHYTHMIA_BEEP_FREQUENCY: number = 440;
  private readonly NORMAL_BEEP_DURATION_MS: number = 80;
  private readonly ARRHYTHMIA_BEEP_DURATION_MS: number = 150;
  private readonly BEEP_VOLUME = 0.7;

  // Patrones de vibración (ms)
  private readonly NORMAL_VIBRATION_PATTERN: number[] = [40];
  private readonly ARRHYTHMIA_VIBRATION_PATTERN: number[] = [80, 40, 80];

  private constructor() {
    this.initAudioContext();
  }

  public static getInstance(): AudioFeedbackService {
    if (!AudioFeedbackService.instance) {
      AudioFeedbackService.instance = new AudioFeedbackService();
    }
    return AudioFeedbackService.instance;
  }

  private initAudioContext(): void {
    if (typeof window !== 'undefined' && !this.audioContext && (window.AudioContext || (window as any).webkitAudioContext)) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log("AudioContext initialized by service.");
        // Solucionar problema de inicio de AudioContext en algunos navegadores (requiere interacción del usuario)
        const resumeAudio = () => {
          if (this.audioContext?.state === 'suspended') {
            this.audioContext.resume().then(() => {
               console.log("AudioContext resumed successfully.");
               document.removeEventListener('click', resumeAudio);
               document.removeEventListener('touchstart', resumeAudio);
            }).catch(e => console.error("Error resuming AudioContext:", e));
          } else {
             document.removeEventListener('click', resumeAudio);
             document.removeEventListener('touchstart', resumeAudio);
          }
        };
        document.addEventListener('click', resumeAudio);
        document.addEventListener('touchstart', resumeAudio);

      } catch (e) {
        console.error("Error initializing AudioContext:", e);
        this.audioContext = null;
      }
    }
  }

  public triggerHeartbeatFeedback(type: HeartbeatFeedbackType = 'normal'): boolean {
    const now = Date.now();
    if (now - this.lastTriggerTime < this.MIN_TRIGGER_INTERVAL_MS) {
      return false;
    }
    
    if (!this.audioContext) {
      this.initAudioContext();
    }

    let soundPlayed = false;
    if (this.audioContext) {
      try {
        const frequency = type === 'normal' ? this.NORMAL_BEEP_FREQUENCY : this.ARRHYTHMIA_BEEP_FREQUENCY;
        const duration = type === 'normal' ? this.NORMAL_BEEP_DURATION_MS : this.ARRHYTHMIA_BEEP_DURATION_MS;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        gainNode.gain.setValueAtTime(this.BEEP_VOLUME, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + duration / 1000);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration / 1000);
        soundPlayed = true;
      } catch (error) {
        console.error("Error playing beep sound:", error);
        soundPlayed = false;
      }
    } else {
      console.warn("AudioContext not available for beep sound.");
    }

    const vibrationSuccess = this.vibrate(type);

    if (soundPlayed || vibrationSuccess) {
       this.lastTriggerTime = now;
       return true;
    }
    return false;
  }

  private vibrate(type: HeartbeatFeedbackType = 'normal'): boolean {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        const pattern = type === 'normal' ? this.NORMAL_VIBRATION_PATTERN : this.ARRHYTHMIA_VIBRATION_PATTERN;
        navigator.vibrate(pattern);
        return true;
      } catch (e) {
        console.error("Error triggering vibration:", e);
        return false;
      }
    } else {
      return false;
    }
  }

  public playBeep(type: HeartbeatFeedbackType = 'normal', volume: number = 0.7): boolean {
    console.warn("playBeep is deprecated, use triggerHeartbeatFeedback instead.");
    return this.triggerHeartbeatFeedback(type);
  }

  public vibrateOnly(type: HeartbeatFeedbackType = 'normal'): void {
    console.log("Triggering vibration only for type:", type);
    this.vibrate(type);
  }

  public cleanUp(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().then(() => {
        console.log("AudioContext closed successfully.");
        this.audioContext = null;
      }).catch(e => console.error("Error closing AudioContext:", e));
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
       navigator.vibrate(0);
    }
  }
}

const AudioFeedbackServiceInstance = AudioFeedbackService.getInstance();
export default AudioFeedbackServiceInstance;
