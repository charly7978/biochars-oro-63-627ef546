
/**
 * Utilidades para manejar la pantalla completa y orientación
 */

export const enterFullScreen = async (): Promise<void> => {
  const elem = document.documentElement;
  try {
    if (elem.requestFullscreen) {
      await elem.requestFullscreen({ navigationUI: "hide" });
    } else if ((elem as any).webkitRequestFullscreen) {
      await (elem as any).webkitRequestFullscreen({ navigationUI: "hide" });
    } else if ((elem as any).mozRequestFullScreen) {
      await (elem as any).mozRequestFullScreen({ navigationUI: "hide" });
    } else if ((elem as any).msRequestFullscreen) {
      await (elem as any).msRequestFullscreen({ navigationUI: "hide" });
    }
    
    // Soporte para Android
    if (window.navigator.userAgent.match(/Android/i)) {
      if ((window as any).AndroidFullScreen) {
        (window as any).AndroidFullScreen.immersiveMode(
          () => { console.log('Modo inmersivo activado'); },
          () => { console.log('Error al activar modo inmersivo'); }
        );
      }
    }
  } catch (err) {
    console.log('Error al entrar en pantalla completa:', err);
  }
};

export const lockOrientation = async (): Promise<void> => {
  try {
    if (screen.orientation?.lock) {
      await screen.orientation.lock('portrait');
    }
  } catch (error) {
    console.log('No se pudo bloquear la orientación:', error);
  }
};

export const setMaxResolution = (): void => {
  if ('devicePixelRatio' in window && window.devicePixelRatio !== 1) {
    document.body.style.zoom = `${1 / window.devicePixelRatio}`;
  }
};

export const disableScrolling = (): (() => void) => {
  const preventScroll = (e: Event) => e.preventDefault();
  
  document.body.addEventListener('touchmove', preventScroll, { passive: false });
  document.body.addEventListener('scroll', preventScroll, { passive: false });
  document.body.addEventListener('touchstart', preventScroll, { passive: false });
  document.body.addEventListener('gesturestart', preventScroll, { passive: false });
  document.body.addEventListener('gesturechange', preventScroll, { passive: false });
  document.body.addEventListener('gestureend', preventScroll, { passive: false });
  
  // Devuelve función de limpieza
  return () => {
    document.body.removeEventListener('touchmove', preventScroll);
    document.body.removeEventListener('scroll', preventScroll);
    document.body.removeEventListener('touchstart', preventScroll);
    document.body.removeEventListener('gesturestart', preventScroll);
    document.body.removeEventListener('gesturechange', preventScroll);
    document.body.removeEventListener('gestureend', preventScroll);
  };
};
