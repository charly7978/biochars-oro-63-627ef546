
/**
 * Centralized service for audio and haptic feedback
 * Only uses real data - no simulation
 */

import { HeartbeatFeedbackType } from "@/hooks/useHeartbeatFeedback";

class AudioFeedbackService {
  private static instance: AudioFeedbackService;
  private audioContext: AudioContext | null = null;
  private lastTriggerTime: number = 0;
  private lastVibrateTime: number = 0;
  private readonly MIN_TRIGGER_INTERVAL_MS: number = 150;
  private readonly MIN_VIBRATE_INTERVAL_MS: number = 300;
  
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
      
      // Ensure vibration is also triggered
      this.vibrate(type);
      
      return true;
    } catch (error) {
      console.error("AudioFeedbackService: Error playing beep:", error);
      return false;
    }
  }

  private vibrate(type: HeartbeatFeedbackType = 'normal'): void {
    // Check if vibration is available
    if (!('vibrate' in navigator)) {
      console.log('Vibration not supported on this device');
      return;
    }
    
    const now = Date.now();
    if (now - this.lastVibrateTime < this.MIN_VIBRATE_INTERVAL_MS) {
      console.log('Skipping vibration - too soon after last vibration');
      return;
    }
    
    this.lastVibrateTime = now;

    try {
      // Multiple attempts with different patterns to maximize chances of working
      if (type === 'normal') {
        // Try first pattern
        navigator.vibrate(60);
        
        // Set a fallback after a short delay
        setTimeout(() => {
          if (window.navigator && window.navigator.vibrate) {
            // Try a stronger pattern
            window.navigator.vibrate([30, 30, 30]);
          }
        }, 10);
        
        console.log('Normal vibration activated with fallback');
      } else if (type === 'arrhythmia') {
        // Stronger pattern for arrhythmia
        navigator.vibrate([70, 50, 140]);
        
        // Set a fallback after a short delay
        setTimeout(() => {
          if (window.navigator && window.navigator.vibrate) {
            // Try a varied pattern
            window.navigator.vibrate([100, 30, 100, 30, 100]);
          }
        }, 10);
        
        console.log('Arrhythmia vibration activated with fallback');
      }
    } catch (error) {
      console.error('Error activating vibration:', error);
      
      // Try a final fallback with a simpler pattern
      try {
        if (window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(100);
          console.log('Fallback vibration attempted');
        }
      } catch (e) {
        console.error('Even fallback vibration failed:', e);
      }
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
