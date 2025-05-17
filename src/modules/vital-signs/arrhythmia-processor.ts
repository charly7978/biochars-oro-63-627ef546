
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { ArrhythmiaPatternDetector } from './arrhythmia/pattern-detector';
import { calculateRMSSD, calculateRRVariation } from './arrhythmia/calculations';
import { RRIntervalData, ArrhythmiaProcessingResult } from './arrhythmia/types';

/**
 * Consolidated arrhythmia detection system - versión mejorada
 * Using only real data without simulation
 * Optimizado para mayor sensibilidad y precisión
 */
export class ArrhythmiaProcessor {
  // Umbrales optimizados para detección mejorada
  private readonly MIN_RR_INTERVALS = 8; // Reducido para mejor sensibilidad
  private readonly MIN_INTERVAL_MS = 500; // Adaptado para rango fisiológico
  private readonly MAX_INTERVAL_MS = 1300; // Adaptado para rango fisiológico
  private readonly MIN_VARIATION_PERCENT = 28; // Umbral reducido para mejorar detección
  private readonly MIN_ARRHYTHMIA_INTERVAL_MS = 8000; // Reducido para pruebas
  
  // Estado
  private rrIntervals: number[] = [];
  private lastPeakTime: number | null = null;
  private arrhythmiaDetected = false;
  private arrhythmiaCount = 0;
  private lastArrhythmiaTime: number = 0;
  private startTime: number = Date.now();
  
  // Secuencia de confirmación de arritmia
  private consecutiveAbnormalBeats = 0;
  private readonly CONSECUTIVE_THRESHOLD = 4; // Reducido para mejorar sensibilidad
  
  // Nuevo: historiales extendidos para análisis avanzado
  private rrIntervalHistory: number[] = [];
  private readonly MAX_HISTORY_LENGTH = 40;
  private beatToNormalRatio: number = 0;
  
  // Detector de patrones
  private patternDetector = new ArrhythmiaPatternDetector();

  /**
   * Process real RR data for arrhythmia detection
   * No simulation is used
   * Implementación mejorada con análisis multi-criterio
   */
  public processRRData(rrData?: RRIntervalData): ArrhythmiaProcessingResult {
    const currentTime = Date.now();
    
    // Update RR intervals with real data
    if (rrData?.intervals && rrData.intervals.length > 0) {
      this.rrIntervals = [...this.rrIntervals, ...rrData.intervals];
      // Keep only the last N intervals
      if (this.rrIntervals.length > this.MIN_RR_INTERVALS * 2) {
        this.rrIntervals = this.rrIntervals.slice(-this.MIN_RR_INTERVALS * 2);
      }
      
      // Actualizar historial extendido para análisis avanzado
      this.rrIntervalHistory = [...this.rrIntervalHistory, ...rrData.intervals];
      if (this.rrIntervalHistory.length > this.MAX_HISTORY_LENGTH) {
        this.rrIntervalHistory = this.rrIntervalHistory.slice(-this.MAX_HISTORY_LENGTH);
      }
      
      this.lastPeakTime = rrData.lastPeakTime;
      
      // Print for debugging
      console.log("ArrhythmiaProcessor: Received RR intervals", {
        count: rrData.intervals.length,
        total: this.rrIntervals.length,
        intervals: rrData.intervals
      });
      
      // Only proceed with sufficient real data
      if (this.rrIntervals.length >= 3) {
        this.detectArrhythmia(currentTime);
      }
    }

    // Build status message
    const arrhythmiaStatusMessage = 
      this.arrhythmiaDetected 
        ? `ARRHYTHMIA DETECTED|${this.arrhythmiaCount}` 
        : `NO ARRHYTHMIAS|${this.arrhythmiaCount}`;
    
    // Additional information only if there's active arrhythmia
    const lastArrhythmiaData = this.arrhythmiaDetected 
      ? {
          timestamp: currentTime,
          rmssd: calculateRMSSD(this.rrIntervals.slice(-8)),
          rrVariation: calculateRRVariation(this.rrIntervals.slice(-8))
        } 
      : null;
    
    return {
      arrhythmiaStatus: arrhythmiaStatusMessage,
      lastArrhythmiaData
    };
  }

  /**
   * Algoritmo optimizado para detección de arritmias en datos reales
   * No se utiliza simulación ni valores de referencia
   */
  private detectArrhythmia(currentTime: number): void {
    if (this.rrIntervals.length < 3) return;
    
    // Tomar intervalos reales para análisis
    const recentRR = this.rrIntervals.slice(-this.MIN_RR_INTERVALS);
    
    // Filtrar solo intervalos fisiológicamente válidos
    const validIntervals = recentRR.filter(interval => 
      interval >= 350 && interval <= 1600 // Rango expandido para detección mejorada
    );
    
    // Require sufficient valid intervals
    if (validIntervals.length < 3) {
      this.consecutiveAbnormalBeats = 0;
      return;
    }
    
    // Calcular promedio de intervalos reales
    const avgRR = validIntervals.reduce((sum, val) => sum + val, 0) / validIntervals.length;
    
    // Obtener el último intervalo real
    const lastRR = validIntervals[validIntervals.length - 1];
    
    // Calcular variación porcentual real
    const variation = Math.abs(lastRR - avgRR) / avgRR * 100;
    
    // Actualizar buffer de patrones con datos reales
    this.patternDetector.updatePatternBuffer(variation / 100);
    
    // Nuevo: detectar variabilidad absoluta
    const absoluteVariation = Math.abs(lastRR - avgRR);
    
    // Detectar latido prematuro con criterio mejorado
    const prematureBeat = variation > this.MIN_VARIATION_PERCENT || absoluteVariation > 200;
    
    // Actualizar contador de anomalías consecutivas
    if (prematureBeat) {
      this.consecutiveAbnormalBeats++;
      
      // Log detection
      console.log("ArrhythmiaProcessor: Possible premature beat in real data", {
        percentageVariation: variation,
        absoluteVariation: absoluteVariation,
        threshold: this.MIN_VARIATION_PERCENT,
        consecutive: this.consecutiveAbnormalBeats,
        avgRR,
        lastRR,
        timestamp: currentTime
      });
    } else {
      this.consecutiveAbnormalBeats = Math.max(0, this.consecutiveAbnormalBeats - 0.5); // Decaimiento más lento
    }
    
    // Nuevo: Calcular pNN50 (porcentaje de diferencias sucesivas mayores a 50ms)
    let nn50Count = 0;
    if (this.rrIntervalHistory.length > 5) {
      for (let i = 1; i < this.rrIntervalHistory.length; i++) {
        if (Math.abs(this.rrIntervalHistory[i] - this.rrIntervalHistory[i-1]) > 50) {
          nn50Count++;
        }
      }
      const pnn50 = (nn50Count / (this.rrIntervalHistory.length - 1)) * 100;
      
      // Detección mejorada basada en pNN50
      const highPNN50 = pnn50 > 25; // Indica alta variabilidad
      
      if (highPNN50) {
        this.consecutiveAbnormalBeats = Math.min(this.consecutiveAbnormalBeats + 0.5, this.CONSECUTIVE_THRESHOLD + 1);
        console.log("ArrhythmiaProcessor: High pNN50 detected", {
          pnn50,
          nn50Count,
          totalIntervals: this.rrIntervalHistory.length - 1
        });
      }
    }
    
    // Comprobar si la arritmia está confirmada con datos reales
    const timeSinceLastArrhythmia = currentTime - this.lastArrhythmiaTime;
    const canDetectNewArrhythmia = timeSinceLastArrhythmia > this.MIN_ARRHYTHMIA_INTERVAL_MS;
    const patternDetected = this.patternDetector.detectArrhythmiaPattern();
    
    if ((this.consecutiveAbnormalBeats >= this.CONSECUTIVE_THRESHOLD || patternDetected) && canDetectNewArrhythmia) {
      this.arrhythmiaCount++;
      this.arrhythmiaDetected = true;
      this.lastArrhythmiaTime = currentTime;
      this.consecutiveAbnormalBeats = 0;
      this.patternDetector.resetPatternBuffer();
      
      console.log("ArrhythmiaProcessor: ARRHYTHMIA CONFIRMED in real data", {
        arrhythmiaCount: this.arrhythmiaCount,
        timeSinceLast: timeSinceLastArrhythmia,
        patternDetected: patternDetected,
        timestamp: currentTime
      });
    }
  }

  /**
   * Reset the processor
   * Ensures all measurements start from zero
   */
  public reset(): void {
    this.rrIntervals = [];
    this.rrIntervalHistory = [];
    this.lastPeakTime = null;
    this.arrhythmiaDetected = false;
    this.arrhythmiaCount = 0;
    this.lastArrhythmiaTime = 0;
    this.startTime = Date.now();
    this.consecutiveAbnormalBeats = 0;
    this.patternDetector.resetPatternBuffer();
    this.beatToNormalRatio = 0;
    
    console.log("ArrhythmiaProcessor: Processor reset", {
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Get current arrhythmia count
   */
  public getArrhythmiaCount(): number {
    return this.arrhythmiaCount;
  }
  
  /**
   * Full reset of the processor including arrhythmia counter
   * This method is added to match the interface expected by VitalSignsProcessor
   */
  public fullReset(): void {
    this.reset();
    this.arrhythmiaCount = 0;
    this.consecutiveAbnormalBeats = 0;
    this.lastArrhythmiaTime = 0;
    this.patternDetector.resetPatternBuffer();
    
    console.log("ArrhythmiaProcessor: Full reset performed", {
      timestamp: new Date().toISOString()
    });
  }
}
