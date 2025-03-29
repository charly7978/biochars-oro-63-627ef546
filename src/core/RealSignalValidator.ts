
import { evaluateSignalQuality } from './RealSignalQualityEvaluator';

export interface SignalValidationResult {
  valid: boolean;
  level: number;
  color: string;
  label: string;
  warnings: string[];
  badSegments: [number, number][];
}

export function validateFullSignal(ppg: number[] | { time: number; value: number }[]): SignalValidationResult {
  // Handle both array types (plain numbers or objects with time/value)
  const values = Array.isArray(ppg) && typeof ppg[0] === 'object' && 'value' in ppg[0] 
    ? (ppg as { time: number; value: number }[]).map(p => p.value)
    : ppg as number[];
  
  const times = Array.isArray(ppg) && typeof ppg[0] === 'object' && 'time' in ppg[0]
    ? (ppg as { time: number; value: number }[]).map(p => p.time)
    : [];

  // If we have only number[] input, use base implementation
  if (times.length === 0) {
    const base = evaluateSignalQuality(values as number[]);
    const warnings: string[] = [];
    const badSegments: [number, number][] = [];
    
    // Verificar señal básica
    if (base.level < 0.4) warnings.push('Energía o forma insuficiente');

    // Validación de picos y ritmo
    let invertedPicos = 0;
    let rrOutOfRange = 0;
    let noPicos = true;
    let segmentStart: number | null = null;
    const now = Date.now();

    for (let i = 1; i < values.length - 1; i++) {
      const prev = values[i - 1];
      const curr = values[i];
      const next = values[i + 1];

      // Detectar picos
      if (curr > prev && curr > next && curr > 0.3) {
        noPicos = false;
        const rr = (values.length / 60) / (i / values.length); // estimado muy básico
        if (rr < 250 || rr > 2000) rrOutOfRange++;
      }

      if (curr < prev && curr < next && curr < -0.2) {
        invertedPicos++;
      }
      
      // Marcar segmentos de tiempo con variabilidad anormal
      const delta = Math.abs(curr - prev);
      if (delta < 0.2 || delta > 5) {
        if (segmentStart === null) segmentStart = now - (values.length - i) * 33; // Estimación de tiempo aproximada
      } else if (segmentStart !== null) {
        badSegments.push([segmentStart, now - (values.length - i) * 33]);
        segmentStart = null;
      }
    }
    
    if (segmentStart !== null) {
      badSegments.push([segmentStart, now]);
    }

    if (noPicos) warnings.push('Sin latidos detectados');
    if (rrOutOfRange > 0) warnings.push('RR fuera de rango');
    if (invertedPicos > 2) warnings.push('Picos invertidos');

    const isValid = warnings.length === 0;
    let finalColor = base.color;
    let label = base.label;

    if (!isValid) {
      finalColor = 'orange';
      label = 'Con errores';
    }

    if (!isValid && base.level < 0.2) {
      finalColor = 'red';
      label = 'Inválida';
    }

    return {
      valid: isValid,
      level: base.level,
      color: finalColor,
      label,
      warnings,
      badSegments
    };
  } else {
    // Implementation for PPGPoint objects with time/value
    if (!ppg || ppg.length < 50) {
      return {
        valid: false,
        level: 0,
        label: 'Sin datos',
        color: 'red',
        warnings: [],
        badSegments: []
      };
    }

    const diffs = times.map((t, i) => i > 0 ? t - times[i - 1] : 0);
    const rr = diffs.filter(d => d > 250 && d < 2000);
    const avgRR = rr.length > 0 ? rr.reduce((a, b) => a + b, 0) / rr.length : 0;
    const level = Math.min(1, Math.max(0, values.length / 600));

    const warnings: string[] = [];
    const badSegments: [number, number][] = [];

    // Detectar picos invertidos (mayoría negativos)
    const negativeDominance = values.filter(v => v < 0).length > values.length * 0.6;
    if (negativeDominance) warnings.push('Picos invertidos');

    // Detectar RR anómalos
    const rrOutliers = diffs.filter(d => d < 250 || d > 2000);
    if (rrOutliers.length > diffs.length * 0.3) warnings.push('RR fuera de rango');

    // Marcar segmentos de tiempo con baja variabilidad o picos erráticos
    let segmentStart: number | null = null;
    const typedPpg = ppg as { time: number; value: number }[];
    
    for (let i = 1; i < typedPpg.length; i++) {
      const delta = Math.abs(typedPpg[i].value - typedPpg[i - 1].value);
      if (delta < 0.2 || delta > 80) {
        if (segmentStart === null) segmentStart = typedPpg[i - 1].time;
      } else if (segmentStart !== null) {
        badSegments.push([segmentStart, typedPpg[i - 1].time]);
        segmentStart = null;
      }
    }
    
    if (segmentStart !== null) {
      badSegments.push([segmentStart, typedPpg[typedPpg.length - 1].time]);
    }

    const label = warnings.length > 0 ? 'Con errores' : 'Señal óptima';
    const color = warnings.length > 0 ? (level > 0.5 ? 'orange' : 'red') : 'green';
    const valid = level > 0.3 && warnings.length <= 2;

    return {
      valid,
      level,
      label,
      color,
      warnings,
      badSegments
    };
  }
}
