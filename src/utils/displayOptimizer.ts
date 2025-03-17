
export const getSignalColor = (isArrhythmia: boolean): string => {
  return isArrhythmia ? '#FF2E2E' : '#0EA5E9';
};

export const isPointInArrhythmiaWindow = (
  pointTime: number,
  arrhythmiaWindows: Array<{startTime: number, endTime: number | null}>,
  now: number
): boolean => {
  return arrhythmiaWindows.some(window => {
    const endTime = window.endTime || now;
    return pointTime >= window.startTime && pointTime <= endTime;
  });
};
