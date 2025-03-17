
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

// Add the missing exports
export const optimizeCanvas = (canvas: HTMLCanvasElement): void => {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
  }
};

export const optimizeElement = (element: HTMLElement): void => {
  if (window.devicePixelRatio > 1) {
    element.style.transform = `scale(${1/window.devicePixelRatio})`;
    element.style.transformOrigin = 'top left';
  }
};

export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};
