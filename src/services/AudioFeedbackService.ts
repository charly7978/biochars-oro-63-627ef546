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
  private readonly NORMAL_BEEP_DURATION_MS: number = 100;
  private readonly ARRHYTHMIA_BEEP_DURATION_MS: number = 200;

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
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log("AudioFeedbackService: Audio context initialized successfully");
    } catch (error) {
      console.error("AudioFeedbackService: Error initializing audio context:", error);
    }
  }

  public triggerHeartbeatFeedback(type: HeartbeatFeedbackType = 'normal'): boolean {
    if (!this.audioContext) {
      this.initAudioContext();
      if (!this.audioContext) {
        console.error("AudioFeedbackService: No audio context available");
        this.vibrateOnly(type);
        return false;
      }
    }

    const now = Date.now();
    if (now - this.lastTriggerTime < this.MIN_TRIGGER_INTERVAL_MS) {
      return false;
    }
    
    this.lastTriggerTime = now;

    // Activate haptic feedback
    this.vibrate(type);
    
    // Generate audio feedback
    this.playBeep(type);
    
    return true;
  }

  public playBeep(type: HeartbeatFeedbackType = 'normal', volume: number = 0.7): boolean {
    try {
      if (!this.audioContext) {
        this.initAudioContext();
        if (!this.audioContext) return false;
      }

      if (this.audioContext.state !== 'running') {
        this.audioContext.resume().catch(err => {
          console.error('Error resuming audio context:', err);
        });
      }

      const ctx = this.audioContext;
      const gainNode = ctx.createGain();
      const oscillator = ctx.createOscillator();

      oscillator.type = type === 'arrhythmia' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(
        type === 'arrhythmia' ? this.ARRHYTHMIA_BEEP_FREQUENCY : this.NORMAL_BEEP_FREQUENCY,
        ctx.currentTime
      );

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        volume, 
        ctx.currentTime + 0.01
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.01, 
        ctx.currentTime + ((type === 'arrhythmia' ? this.ARRHYTHMIA_BEEP_DURATION_MS : this.NORMAL_BEEP_DURATION_MS) / 1000)
      );

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + ((type === 'arrhythmia' ? this.ARRHYTHMIA_BEEP_DURATION_MS : this.NORMAL_BEEP_DURATION_MS) / 1000) + 0.02);

      console.log(`AudioFeedbackService: Beep de ${type} reproducido exitosamente`);
      return true;
    } catch (error) {
      console.error("AudioFeedbackService: Error playing beep:", error);
      return false;
    }
  }

  private vibrate(type: HeartbeatFeedbackType = 'normal'): void {
    if (!('vibrate' in navigator)) {
      console.log('Vibración no soportada en este dispositivo');
      return;
    }

    try {
      let pattern;
      if (type === 'normal') {
        pattern = 60;
        console.log('Intentando vibrar (normal):', pattern);
        const ok = navigator.vibrate(pattern);
        console.log('Resultado vibración normal:', ok);
      } else if (type === 'arrhythmia') {
        pattern = [70, 50, 140];
        console.log('Intentando vibrar (arritmia):', pattern);
        const ok = navigator.vibrate(pattern);
        console.log('Resultado vibración arritmia:', ok);
      }
    } catch (error) {
      console.error('Error al activar vibración:', error);
    }
  }

  private vibrateOnly(type: HeartbeatFeedbackType = 'normal'): void {
    this.vibrate(type);
  }

  public cleanUp(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(err => {
        console.error('Error closing audio context:', err);
      });
      this.audioContext = null;
    }
  }
}

export default AudioFeedbackService.getInstance();
