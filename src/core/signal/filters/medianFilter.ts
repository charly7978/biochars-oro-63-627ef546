/**
 * Calcula la mediana de un array de números.
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  // Clonar y ordenar el array para no modificar el original
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  // Si la longitud es par, la mediana es el promedio de los dos valores centrales
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  // Si la longitud es impar, la mediana es el valor central
  return sorted[middle];
}

/**
 * Aplica un filtro de mediana a un valor dado, utilizando un buffer.
 * Mantiene y devuelve el buffer actualizado.
 *
 * @param value El valor actual de la señal.
 * @param buffer El buffer de valores anteriores.
 * @param windowSize El tamaño de la ventana del filtro.
 * @returns Objeto con el valor filtrado y el buffer actualizado.
 */
export function applyMedianFilter(value: number, buffer: number[], windowSize: number): {
  filteredValue: number;
  updatedBuffer: number[];
} {
  // Crear un nuevo buffer con el valor actual
  const newBuffer = [...buffer, value];

  // Limitar el tamaño del buffer
  if (newBuffer.length > windowSize) {
    newBuffer.shift(); // Eliminar el valor más antiguo
  }

  // Calcular la mediana usando solo los valores dentro de la ventana actual
  const windowedBuffer = newBuffer.slice(-windowSize);
  const filteredValue = calculateMedian(windowedBuffer);

  return { filteredValue, updatedBuffer: newBuffer };
} 