
import { evaluateSignalQuality } from './RealSignalQualityEvaluator';

export interface SignalValidationResult {
  valid: boolean;
  level: number;
  color: string;
  label: string;
  warnings: string[];
  badSegments: Array<[number, number]>; // Add badSegments property to store invalid time segments
}

export function validateFullSignal(ppg: number[]): SignalValidationResult {
  const base = evaluateSignalQuality(ppg);
  const warnings: string[] = [];
  const badSegments: Array<[number, number]> = [];
  const now = Date.now();

  // Verificar señal básica
  if (base.level < 0.4) warnings.push('Energía o forma insuficiente');

  // Validación de picos y ritmo
  let invertedPicos = 0;
  let rrOutOfRange = 0;
  let noPicos = true;
  let badSegmentStart: number | null = null;

  for (let i = 1; i < ppg.length - 1; i++) {
    const prev = ppg[i - 1];
    const curr = ppg[i];
    const next = ppg[i + 1];
    
    // Determine time for this point in the ppg array (approximate based on array index)
    const timeForIndex = now - ((ppg.length - i) * (5500 / ppg.length));
    
    const isPointValid = Math.abs(curr) > 0.1 && Math.abs(curr - prev) < 1.5;
    
    // Start a bad segment
    if (isPointValid === false && badSegmentStart === null) {
      badSegmentStart = timeForIndex;
    }
    
    // End a bad segment
    if (isPointValid === true && badSegmentStart !== null) {
      badSegments.push([badSegmentStart, timeForIndex]);
      badSegmentStart = null;
    }

    // Detectar picos
    if (curr > prev && curr > next && curr > 0.3) {
      noPicos = false;
      const rr = (ppg.length / 60) / (i / ppg.length); // estimado muy básico
      if (rr < 250 || rr > 2000) rrOutOfRange++;
    }

    if (curr < prev && curr < next && curr < -0.2) {
      invertedPicos++;
    }
  }
  
  // Close any open bad segment
  if (badSegmentStart !== null) {
    badSegments.push([badSegmentStart, now]);
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
