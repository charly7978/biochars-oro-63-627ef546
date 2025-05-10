
import { useState, useEffect } from 'react';

export const detectPlatform = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  const isAndroid = /android/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isWindows = /windows nt/i.test(userAgent);
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
  
  return {
    userAgent,
    isAndroid,
    isIOS,
    isWindows,
    isMobile
  };
};

export const usePlatformDetection = () => {
  const [isAndroid, setIsAndroid] = useState(false);
  const [isWindows, setIsWindows] = useState(false);
  
  useEffect(() => {
    const platform = detectPlatform();
    
    console.log("Plataforma detectada:", platform);
    
    setIsAndroid(platform.isAndroid);
    setIsWindows(platform.isWindows);
  }, []);
  
  return { isAndroid, isWindows };
};

export const getDeviceSpecificConstraints = (): MediaStreamConstraints => {
  const platform = detectPlatform();
  
  const baseVideoConstraints: MediaTrackConstraints = {
    facingMode: 'environment',
    width: { ideal: 1920 },
    height: { ideal: 1080 }
  };

  if (platform.isAndroid) {
    console.log("Configurando para Android");
    Object.assign(baseVideoConstraints, {
      frameRate: { ideal: 30, max: 60 },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    });
  } else if (platform.isIOS) {
    console.log("Configurando para iOS");
    Object.assign(baseVideoConstraints, {
      frameRate: { ideal: 60, max: 60 },
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    });
  } else if (platform.isWindows) {
    console.log("Configurando para Windows con resolución reducida (720p)");
    Object.assign(baseVideoConstraints, {
      frameRate: { ideal: 30, max: 60 },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    });
  } else {
    console.log("Configurando para escritorio con máxima resolución");
    Object.assign(baseVideoConstraints, {
      frameRate: { ideal: 60, max: 60 },
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    });
  }

  return {
    video: baseVideoConstraints,
    audio: false
  };
};

