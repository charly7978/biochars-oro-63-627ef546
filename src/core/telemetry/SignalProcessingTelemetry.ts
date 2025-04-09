
/**
 * Sistema de telemetría avanzada para el procesamiento de señales
 * Registra métricas de rendimiento en cada etapa
 */

export enum TelemetryCategory {
  SIGNAL_CAPTURE = 'signal_capture',
  SIGNAL_PROCESSING = 'signal_processing',
  FILTER_APPLICATION = 'filter_application',
  PEAK_DETECTION = 'peak_detection',
  FEATURE_EXTRACTION = 'feature_extraction',
  HEART_RATE_CALCULATION = 'heart_rate_calculation',
  PARALLEL_PROCESSING = 'parallel_processing',
  MEMORY_MANAGEMENT = 'memory_management',
  VITAL_SIGNS_CALCULATION = 'vital_signs_calculation'
}

interface TelemetryMetric {
  timestamp: number;
  category: TelemetryCategory;
  name: string;
  value: number;
  unit: string;
  context?: Record<string, any>;
}

interface TelemetryEvent {
  timestamp: number;
  category: TelemetryCategory;
  name: string;
  details?: Record<string, any>;
}

interface ProcessingPhaseMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  measurements: Record<string, number>;
  events: TelemetryEvent[];
}

export class SignalProcessingTelemetry {
  private static instance: SignalProcessingTelemetry;
  
  private metrics: TelemetryMetric[] = [];
  private events: TelemetryEvent[] = [];
  private activePhases: Map<string, ProcessingPhaseMetrics> = new Map();
  
  private readonly MAX_METRICS = 5000;
  private readonly MAX_EVENTS = 1000;
  
  private readonly TRIM_THRESHOLD = 0.9; // Eliminar el 10% más antiguo cuando se alcance el límite
  
  private constructor() {
    console.log('SignalProcessingTelemetry: Iniciando sistema de telemetría avanzada');
  }
  
  /**
   * Obtiene la instancia única del sistema de telemetría
   */
  public static getInstance(): SignalProcessingTelemetry {
    if (!SignalProcessingTelemetry.instance) {
      SignalProcessingTelemetry.instance = new SignalProcessingTelemetry();
    }
    return SignalProcessingTelemetry.instance;
  }
  
  /**
   * Registra una métrica individual
   */
  public recordMetric(
    category: TelemetryCategory,
    name: string,
    value: number,
    unit: string,
    context?: Record<string, any>
  ): void {
    const metric: TelemetryMetric = {
      timestamp: Date.now(),
      category,
      name,
      value,
      unit,
      context
    };
    
    this.metrics.push(metric);
    this.trimMetricsIfNeeded();
  }
  
  /**
   * Registra un evento del sistema
   */
  public recordEvent(
    category: TelemetryCategory,
    name: string,
    details?: Record<string, any>
  ): void {
    const event: TelemetryEvent = {
      timestamp: Date.now(),
      category,
      name,
      details
    };
    
    this.events.push(event);
    this.trimEventsIfNeeded();
  }
  
  /**
   * Inicia el seguimiento de una fase de procesamiento
   */
  public startPhase(phaseId: string, category: TelemetryCategory): void {
    if (this.activePhases.has(phaseId)) {
      console.warn(`SignalProcessingTelemetry: La fase ${phaseId} ya está activa`);
      return;
    }
    
    this.activePhases.set(phaseId, {
      startTime: performance.now(),
      measurements: {},
      events: []
    });
    
    this.recordEvent(category, `phase_start`, { phaseId });
  }
  
  /**
   * Registra una medición para una fase activa
   */
  public measurePhase(
    phaseId: string,
    name: string,
    value: number,
    unit: string
  ): void {
    if (!this.activePhases.has(phaseId)) {
      console.warn(`SignalProcessingTelemetry: La fase ${phaseId} no está activa`);
      return;
    }
    
    const phase = this.activePhases.get(phaseId)!;
    phase.measurements[name] = value;
  }
  
  /**
   * Registra un evento para una fase activa
   */
  public recordPhaseEvent(
    phaseId: string,
    name: string,
    details?: Record<string, any>
  ): void {
    if (!this.activePhases.has(phaseId)) {
      console.warn(`SignalProcessingTelemetry: La fase ${phaseId} no está activa`);
      return;
    }
    
    const phase = this.activePhases.get(phaseId)!;
    const event: TelemetryEvent = {
      timestamp: Date.now(),
      category: TelemetryCategory.SIGNAL_PROCESSING,
      name,
      details
    };
    
    phase.events.push(event);
  }
  
  /**
   * Finaliza el seguimiento de una fase
   */
  public endPhase(phaseId: string, category: TelemetryCategory): ProcessingPhaseMetrics | null {
    if (!this.activePhases.has(phaseId)) {
      console.warn(`SignalProcessingTelemetry: La fase ${phaseId} no está activa`);
      return null;
    }
    
    const phase = this.activePhases.get(phaseId)!;
    phase.endTime = performance.now();
    phase.duration = phase.endTime - phase.startTime;
    
    // Registrar duración de la fase como una métrica
    this.recordMetric(
      category,
      `${phaseId}_duration`,
      phase.duration,
      'ms',
      { measurements: phase.measurements }
    );
    
    // Registrar evento de finalización
    this.recordEvent(category, `phase_end`, {
      phaseId,
      duration: phase.duration,
      measurements: phase.measurements
    });
    
    // Eliminar la fase activa
    this.activePhases.delete(phaseId);
    
    return phase;
  }
  
  /**
   * Obtiene todas las métricas registradas
   */
  public getMetrics(): TelemetryMetric[] {
    return [...this.metrics];
  }
  
  /**
   * Obtiene las métricas filtradas por categoría
   */
  public getMetricsByCategory(category: TelemetryCategory): TelemetryMetric[] {
    return this.metrics.filter(metric => metric.category === category);
  }
  
  /**
   * Obtiene todos los eventos registrados
   */
  public getEvents(): TelemetryEvent[] {
    return [...this.events];
  }
  
  /**
   * Obtiene los eventos filtrados por categoría
   */
  public getEventsByCategory(category: TelemetryCategory): TelemetryEvent[] {
    return this.events.filter(event => event.category === category);
  }
  
  /**
   * Obtiene resumen de métricas para una categoría específica
   */
  public getMetricsSummary(category: TelemetryCategory, metricName: string): {
    min: number;
    max: number;
    avg: number;
    count: number;
    last: number;
  } {
    const filteredMetrics = this.metrics.filter(
      m => m.category === category && m.name === metricName
    );
    
    if (filteredMetrics.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0, last: 0 };
    }
    
    const values = filteredMetrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      count: values.length,
      last: values[values.length - 1]
    };
  }
  
  /**
   * Limpia métricas antiguas si se excede el límite
   */
  private trimMetricsIfNeeded(): void {
    if (this.metrics.length > this.MAX_METRICS) {
      const keepCount = Math.floor(this.MAX_METRICS * this.TRIM_THRESHOLD);
      this.metrics = this.metrics.slice(-keepCount);
    }
  }
  
  /**
   * Limpia eventos antiguos si se excede el límite
   */
  private trimEventsIfNeeded(): void {
    if (this.events.length > this.MAX_EVENTS) {
      const keepCount = Math.floor(this.MAX_EVENTS * this.TRIM_THRESHOLD);
      this.events = this.events.slice(-keepCount);
    }
  }
  
  /**
   * Limpia todos los datos de telemetría
   */
  public clear(): void {
    this.metrics = [];
    this.events = [];
    this.activePhases.clear();
  }
  
  /**
   * Genera un reporte JSON con todas las métricas y eventos
   */
  public generateReport(): string {
    return JSON.stringify({
      metrics: this.metrics,
      events: this.events,
      activePhases: Array.from(this.activePhases.entries())
    }, null, 2);
  }
}
