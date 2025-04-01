
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Validador cruzado de signos vitales
 * Utiliza correlaciones fisiológicas para validar la consistencia de las mediciones
 */

import { VitalSignType } from '../../../types/signal';

/**
 * Interfaz para las mediciones a validar
 */
export interface MeasurementsToValidate {
  spo2?: number;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  glucose?: number;
  cholesterol?: number;
  triglycerides?: number;
}

/**
 * Resultado de la validación
 */
export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  adjustmentFactors: Record<string, number>;
  inconsistencies: string[];
}

/**
 * Validador cruzado para signos vitales
 * Implementa reglas fisiológicas para validar la consistencia de las mediciones
 */
export class CrossValidator {
  private static instance: CrossValidator;
  
  // Valores de referencia para correlaciones
  private readonly SPO2_MIN = 90;
  private readonly SPO2_MAX = 100;
  private readonly HR_MIN = 40;
  private readonly HR_MAX = 180;
  private readonly SYSTOLIC_MIN = 80;
  private readonly SYSTOLIC_MAX = 200;
  private readonly DIASTOLIC_MIN = 40;
  private readonly DIASTOLIC_MAX = 120;
  
  /**
   * Constructor privado para singleton
   */
  private constructor() {
    console.log("CrossValidator: Inicializado con reglas fisiológicas");
  }
  
  /**
   * Obtener instancia única
   */
  public static getInstance(): CrossValidator {
    if (!CrossValidator.instance) {
      CrossValidator.instance = new CrossValidator();
    }
    return CrossValidator.instance;
  }
  
  /**
   * Validar un conjunto de mediciones
   * @param measurements Mediciones a validar
   * @returns Resultado de la validación
   */
  public validateMeasurements(measurements: MeasurementsToValidate): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      confidence: 1.0,
      adjustmentFactors: {},
      inconsistencies: []
    };
    
    // Verificar rangos fisiológicos básicos
    this.validatePhysiologicalRanges(measurements, result);
    
    // Verificar correlaciones entre signos vitales
    this.validateCorrelations(measurements, result);
    
    // Calcular confianza general basada en inconsistencias
    if (result.inconsistencies.length > 0) {
      // Reducir confianza por cada inconsistencia
      result.confidence = Math.max(0.1, 1 - (result.inconsistencies.length * 0.15));
      
      // Si hay demasiadas inconsistencias, invalidar resultado
      if (result.inconsistencies.length > 4) {
        result.isValid = false;
      }
    }
    
    console.log("CrossValidator: Validación completada", {
      isValid: result.isValid,
      confidence: result.confidence,
      inconsistencias: result.inconsistencies.length
    });
    
    return result;
  }
  
  /**
   * Validar que las mediciones estén en rangos fisiológicos
   */
  private validatePhysiologicalRanges(
    measurements: MeasurementsToValidate, 
    result: ValidationResult
  ): void {
    // Validar SpO2
    if (measurements.spo2 !== undefined) {
      if (measurements.spo2 < this.SPO2_MIN || measurements.spo2 > this.SPO2_MAX) {
        result.inconsistencies.push(`SpO2 fuera de rango: ${measurements.spo2}`);
        result.adjustmentFactors['spo2'] = 
          measurements.spo2 < this.SPO2_MIN ? 
          this.SPO2_MIN / measurements.spo2 : 
          this.SPO2_MAX / measurements.spo2;
      }
    }
    
    // Validar frecuencia cardíaca
    if (measurements.heartRate !== undefined) {
      if (measurements.heartRate < this.HR_MIN || measurements.heartRate > this.HR_MAX) {
        result.inconsistencies.push(`Frecuencia cardíaca fuera de rango: ${measurements.heartRate}`);
        result.adjustmentFactors['heartRate'] = 
          measurements.heartRate < this.HR_MIN ? 
          this.HR_MIN / measurements.heartRate : 
          this.HR_MAX / measurements.heartRate;
      }
    }
    
    // Validar presión sistólica
    if (measurements.systolic !== undefined) {
      if (measurements.systolic < this.SYSTOLIC_MIN || measurements.systolic > this.SYSTOLIC_MAX) {
        result.inconsistencies.push(`Presión sistólica fuera de rango: ${measurements.systolic}`);
        result.adjustmentFactors['systolic'] = 
          measurements.systolic < this.SYSTOLIC_MIN ? 
          this.SYSTOLIC_MIN / measurements.systolic : 
          this.SYSTOLIC_MAX / measurements.systolic;
      }
    }
    
    // Validar presión diastólica
    if (measurements.diastolic !== undefined) {
      if (measurements.diastolic < this.DIASTOLIC_MIN || measurements.diastolic > this.DIASTOLIC_MAX) {
        result.inconsistencies.push(`Presión diastólica fuera de rango: ${measurements.diastolic}`);
        result.adjustmentFactors['diastolic'] = 
          measurements.diastolic < this.DIASTOLIC_MIN ? 
          this.DIASTOLIC_MIN / measurements.diastolic : 
          this.DIASTOLIC_MAX / measurements.diastolic;
      }
    }
    
    // Validar relación sistólica/diastólica
    if (measurements.systolic !== undefined && measurements.diastolic !== undefined) {
      if (measurements.diastolic >= measurements.systolic) {
        result.inconsistencies.push(`Relación sistólica/diastólica invertida: ${measurements.systolic}/${measurements.diastolic}`);
        
        // Ajustar ambos valores para mantener una relación más fisiológica
        const avg = (measurements.systolic + measurements.diastolic) / 2;
        result.adjustmentFactors['systolic'] = 1.2; // Aumentar sistólica
        result.adjustmentFactors['diastolic'] = 0.8; // Reducir diastólica
      }
      
      // Verificar diferencia sistólica-diastólica (pulso)
      const pulsePressure = measurements.systolic - measurements.diastolic;
      if (pulsePressure < 20 || pulsePressure > 60) {
        result.inconsistencies.push(`Presión de pulso anormal: ${pulsePressure}`);
        
        // No aplicamos ajuste aquí porque podría crear inconsistencias
        // con los ajustes individuales
      }
    }
  }
  
  /**
   * Validar correlaciones entre diferentes signos vitales
   */
  private validateCorrelations(
    measurements: MeasurementsToValidate, 
    result: ValidationResult
  ): void {
    // Correlación entre frecuencia cardíaca y presión arterial
    if (measurements.heartRate !== undefined && 
        measurements.systolic !== undefined &&
        measurements.diastolic !== undefined) {
      
      // La presión arterial tiende a aumentar con la frecuencia cardíaca
      // Verificamos si esta correlación se mantiene en rangos razonables
      
      // HR elevada debería correlacionarse con presión más alta
      if (measurements.heartRate > 100 && 
          measurements.systolic < 110 && 
          measurements.diastolic < 70) {
        result.inconsistencies.push(
          `Inconsistencia HR-BP: HR elevada (${measurements.heartRate}) con PA baja (${measurements.systolic}/${measurements.diastolic})`
        );
        
        // Sugerir ajuste hacia arriba de la presión
        result.adjustmentFactors['systolic'] = 1.15;
        result.adjustmentFactors['diastolic'] = 1.1;
      }
      
      // HR baja debería correlacionarse con presión más baja
      if (measurements.heartRate < 60 && 
          measurements.systolic > 140 && 
          measurements.diastolic > 90) {
        result.inconsistencies.push(
          `Inconsistencia HR-BP: HR baja (${measurements.heartRate}) con PA elevada (${measurements.systolic}/${measurements.diastolic})`
        );
        
        // Sugerir ajuste hacia abajo de la presión
        result.adjustmentFactors['systolic'] = 0.9;
        result.adjustmentFactors['diastolic'] = 0.9;
      }
    }
    
    // Correlación entre SpO2 y frecuencia cardíaca
    if (measurements.spo2 !== undefined && measurements.heartRate !== undefined) {
      // SpO2 baja suele correlacionarse con HR elevada (compensación)
      if (measurements.spo2 < 92 && measurements.heartRate < 70) {
        result.inconsistencies.push(
          `Inconsistencia SpO2-HR: SpO2 baja (${measurements.spo2}) con HR normal-baja (${measurements.heartRate})`
        );
        
        // Sugerir ajuste de SpO2 hacia arriba si HR es normal
        result.adjustmentFactors['spo2'] = 1.05;
      }
      
      // SpO2 normal con HR muy elevada sin otra causa aparente
      if (measurements.spo2 > 97 && measurements.heartRate > 120) {
        result.inconsistencies.push(
          `Posible inconsistencia SpO2-HR: SpO2 normal (${measurements.spo2}) con HR muy elevada (${measurements.heartRate})`
        );
        
        // No ajustamos porque podría haber otras causas fisiológicas
        // para taquicardia con SpO2 normal
      }
    }
    
    // Correlación entre glucosa y lípidos (correlaciones metabólicas)
    if (measurements.glucose !== undefined && 
        (measurements.cholesterol !== undefined || measurements.triglycerides !== undefined)) {
      
      // Glucosa alta suele correlacionarse con perfil lipídico alterado
      if (measurements.glucose > 150) {
        if (measurements.cholesterol !== undefined && measurements.cholesterol < 150) {
          result.inconsistencies.push(
            `Posible inconsistencia glucosa-colesterol: Glucosa alta (${measurements.glucose}) con colesterol bajo (${measurements.cholesterol})`
          );
          
          // Sugerencia leve de ajuste al colesterol
          result.adjustmentFactors['cholesterol'] = 1.1;
        }
        
        if (measurements.triglycerides !== undefined && measurements.triglycerides < 120) {
          result.inconsistencies.push(
            `Posible inconsistencia glucosa-triglicéridos: Glucosa alta (${measurements.glucose}) con triglicéridos bajos (${measurements.triglycerides})`
          );
          
          // Sugerencia leve de ajuste a los triglicéridos
          result.adjustmentFactors['triglycerides'] = 1.15;
        }
      }
    }
  }
  
  /**
   * Aplicar factores de ajuste a las mediciones
   * @param measurements Mediciones originales
   * @param validationResult Resultado de la validación
   * @returns Mediciones ajustadas
   */
  public applyAdjustments(
    measurements: MeasurementsToValidate, 
    validationResult: ValidationResult
  ): MeasurementsToValidate {
    // Si no es válido o no hay ajustes, devolver original
    if (!validationResult.isValid || Object.keys(validationResult.adjustmentFactors).length === 0) {
      return { ...measurements };
    }
    
    const adjusted: MeasurementsToValidate = { ...measurements };
    
    // Aplicar factores de ajuste
    if (validationResult.adjustmentFactors['spo2'] && adjusted.spo2 !== undefined) {
      adjusted.spo2 = Math.round(adjusted.spo2 * validationResult.adjustmentFactors['spo2']);
      // Asegurar que esté en rango fisiológico
      adjusted.spo2 = Math.min(100, Math.max(90, adjusted.spo2));
    }
    
    if (validationResult.adjustmentFactors['systolic'] && adjusted.systolic !== undefined) {
      adjusted.systolic = Math.round(adjusted.systolic * validationResult.adjustmentFactors['systolic']);
      // Asegurar que esté en rango fisiológico
      adjusted.systolic = Math.min(200, Math.max(80, adjusted.systolic));
    }
    
    if (validationResult.adjustmentFactors['diastolic'] && adjusted.diastolic !== undefined) {
      adjusted.diastolic = Math.round(adjusted.diastolic * validationResult.adjustmentFactors['diastolic']);
      // Asegurar que esté en rango fisiológico
      adjusted.diastolic = Math.min(120, Math.max(40, adjusted.diastolic));
    }
    
    if (validationResult.adjustmentFactors['heartRate'] && adjusted.heartRate !== undefined) {
      adjusted.heartRate = Math.round(adjusted.heartRate * validationResult.adjustmentFactors['heartRate']);
      // Asegurar que esté en rango fisiológico
      adjusted.heartRate = Math.min(180, Math.max(40, adjusted.heartRate));
    }
    
    if (validationResult.adjustmentFactors['glucose'] && adjusted.glucose !== undefined) {
      adjusted.glucose = Math.round(adjusted.glucose * validationResult.adjustmentFactors['glucose']);
      // Asegurar que esté en rango fisiológico
      adjusted.glucose = Math.min(300, Math.max(70, adjusted.glucose));
    }
    
    if (validationResult.adjustmentFactors['cholesterol'] && adjusted.cholesterol !== undefined) {
      adjusted.cholesterol = Math.round(adjusted.cholesterol * validationResult.adjustmentFactors['cholesterol']);
      // Asegurar que esté en rango fisiológico
      adjusted.cholesterol = Math.min(300, Math.max(100, adjusted.cholesterol));
    }
    
    if (validationResult.adjustmentFactors['triglycerides'] && adjusted.triglycerides !== undefined) {
      adjusted.triglycerides = Math.round(adjusted.triglycerides * validationResult.adjustmentFactors['triglycerides']);
      // Asegurar que esté en rango fisiológico
      adjusted.triglycerides = Math.min(300, Math.max(50, adjusted.triglycerides));
    }
    
    // Verificar nuevamente relación sistólica/diastólica
    if (adjusted.systolic !== undefined && adjusted.diastolic !== undefined) {
      if (adjusted.diastolic >= adjusted.systolic) {
        // Forzar una relación válida
        const systolic = adjusted.systolic;
        const diastolic = adjusted.diastolic;
        
        // Ajustar para crear una diferencia mínima de 20 mmHg
        adjusted.systolic = Math.max(systolic, diastolic + 20);
        adjusted.diastolic = Math.min(diastolic, systolic - 20);
      }
    }
    
    return adjusted;
  }
}
