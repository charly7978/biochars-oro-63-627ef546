
import { evaluateSignalQuality } from './RealSignalQualityEvaluator';

export interface SignalValidationResult {
  valid: boolean;
  level: number;
  color: string;
  label: string;
  warnings: string[];
  badSegments: [number, number][];
}

export function validateFullSignal(ppg: number[]): SignalValidationResult {
  const base = evaluateSignalQuality(ppg);
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

  for (let i = 1; i < ppg.length - 1; i++) {
    const prev = ppg[i - 1];
    const curr = ppg[i];
    const next = ppg[i + 1];

    // Detectar picos
    if (curr > prev && curr > next && curr > 0.3) {
      noPicos = false;
      const rr = (ppg.length / 60) / (i / ppg.length); // estimado muy básico
      if (rr < 250 || rr > 2000) rrOutOfRange++;
    }

    if (curr < prev && curr < next && curr < -0.2) {
      invertedPicos++;
    }
    
    // Marcar segmentos de tiempo con variabilidad anormal
    const delta = Math.abs(curr - prev);
    if (delta < 0.2 || delta > 5) {
      if (segmentStart === null) segmentStart = now - (ppg.length - i) * 33; // Estimación de tiempo aproximada
    } else if (segmentStart !== null) {
      badSegments.push([segmentStart, now - (ppg.length - i) * 33]);
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
}
