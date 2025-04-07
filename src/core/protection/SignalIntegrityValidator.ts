
/**
 * Validador de Integridad de Señales
 * Verifica que el procesamiento de señales PPG cumple con estándares
 * de calidad y no utiliza simulación
 */

import { shield } from './index';
import { VerificationResult, VerificationType, ViolationDetail } from './types';

export class SignalIntegrityValidator {
  /**
   * Verifica la integridad de una señal PPG procesada
   * @param signal Datos de la señal a verificar
   * @param context Contexto de la verificación
   * @returns Resultado de la verificación
   */
  public async validatePPGSignal(
    signal: any,
    context: { timestamp: number, source: string }
  ): Promise<VerificationResult> {
    const violations: ViolationDetail[] = [];
    
    // Validar si hay patrones de simulación
    const simulationViolations = this.checkForSimulation(signal);
    violations.push(...simulationViolations);
    
    // Validar si los valores son fisiológicamente plausibles
    const physiologicalViolations = this.checkPhysiologicalPlausibility(signal);
    violations.push(...physiologicalViolations);
    
    // Validar presencia de artefactos o contaminación
    const artifactViolations = this.checkForArtifacts(signal);
    violations.push(...artifactViolations);
    
    // Determinar resultado en base a violaciones
    const hasCriticalViolations = violations.some(v => v.severity === 'high');
    
    const result: VerificationResult = {
      success: !hasCriticalViolations,
      message: hasCriticalViolations
        ? "La señal PPG contiene anomalías críticas que sugieren posible simulación"
        : "Verificación de señal PPG completada",
      details: {
        violations,
        timestamp: Date.now(),
        context
      }
    };
    
    // Registrar el resultado en el shield
    shield.logVerification({
      type: 'signal_verification',
      result,
      timestamp: Date.now(),
      context: {
        fileName: context.source,
        moduleName: 'signal-integrity'
      }
    });
    
    return result;
  }
  
  /**
   * Verifica patrones que sugieran simulación de datos
   */
  private checkForSimulation(signal: any): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Buscar periodicidad exacta (sugerente de simulación)
    if (signal.values && signal.values.length > 20) {
      const values = signal.values.slice(-20);
      const diffs = [];
      
      for (let i = 1; i < values.length; i++) {
        diffs.push(values[i] - values[i-1]);
      }
      
      const avgDiff = diffs.reduce((sum, val) => sum + val, 0) / diffs.length;
      const diffVariance = diffs.reduce((sum, val) => sum + Math.pow(val - avgDiff, 2), 0) / diffs.length;
      
      // Varianza extremadamente baja sugiere datos generados artificialmente
      if (diffVariance < 0.00001 && avgDiff !== 0) {
        violations.push({
          type: VerificationType.DATA_INTEGRITY,
          message: "Periodicidad exacta detectada, posible simulación",
          severity: 'high',
          location: "signal.values"
        });
      }
    }
    
    // Verificar si hay valores constantes exactos repetidos
    if (signal.heartRateValues && signal.heartRateValues.length > 5) {
      const values = signal.heartRateValues.slice(-5);
      const allEqual = values.every(v => v === values[0]) && values[0] !== 0;
      
      if (allEqual) {
        violations.push({
          type: VerificationType.DATA_INTEGRITY,
          message: "Valores de frecuencia cardíaca idénticos consecutivos detectados",
          severity: 'medium',
          location: "signal.heartRateValues"
        });
      }
    }
    
    return violations;
  }
  
  /**
   * Verifica plausibilidad fisiológica de los datos
   */
  private checkPhysiologicalPlausibility(signal: any): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Verificar rangos fisiológicos para frecuencia cardíaca
    if (signal.heartRate !== undefined && 
        (signal.heartRate < 30 || signal.heartRate > 220)) {
      violations.push({
        type: VerificationType.DATA_INTEGRITY,
        message: `Frecuencia cardíaca fuera de rango fisiológico: ${signal.heartRate}`,
        severity: 'medium',
        location: "signal.heartRate"
      });
    }
    
    // Verificar saturación de oxígeno
    if (signal.spo2 !== undefined && 
        (signal.spo2 < 70 || signal.spo2 > 100)) {
      violations.push({
        type: VerificationType.DATA_INTEGRITY,
        message: `Valor de SpO2 improbable: ${signal.spo2}`,
        severity: 'medium',
        location: "signal.spo2"
      });
    }
    
    return violations;
  }
  
  /**
   * Verifica presencia de artefactos en la señal
   */
  private checkForArtifacts(signal: any): ViolationDetail[] {
    const violations: ViolationDetail[] = [];
    
    // Verificar calidad de señal
    if (signal.quality !== undefined && signal.quality < 20 && signal.fingerDetected) {
      violations.push({
        type: VerificationType.DATA_INTEGRITY,
        message: `Calidad de señal baja pero detección de dedo positiva: ${signal.quality}`,
        severity: 'low',
        location: "signal.quality"
      });
    }
    
    // Verificar cambios bruscos (artefactos)
    if (signal.values && signal.values.length > 10) {
      const recentValues = signal.values.slice(-10);
      const diffs = [];
      
      for (let i = 1; i < recentValues.length; i++) {
        diffs.push(Math.abs(recentValues[i] - recentValues[i-1]));
      }
      
      const maxDiff = Math.max(...diffs);
      const avgVal = recentValues.reduce((sum, val) => sum + Math.abs(val), 0) / recentValues.length;
      
      if (maxDiff > avgVal * 5) {
        violations.push({
          type: VerificationType.DATA_INTEGRITY,
          message: "Cambio brusco detectado en la señal, posible artefacto",
          severity: 'low',
          location: "signal.values"
        });
      }
    }
    
    return violations;
  }
}
