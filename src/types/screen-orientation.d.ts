
declare global {
  interface ScreenOrientation {
    angle: number;
    onchange: ((this: ScreenOrientation, ev: Event) => any) | null;
    type: OrientationType;
    lock(orientation: OrientationType): Promise<void>;
    unlock(): void;
  }

  type OrientationType = 
    | 'any'
    | 'natural'
    | 'landscape'
    | 'portrait'
    | 'portrait-primary'
    | 'portrait-secondary'
    | 'landscape-primary'
    | 'landscape-secondary';

  interface Screen {
    orientation?: ScreenOrientation;
  }

  interface HTMLElement {
    requestFullscreen(options?: FullscreenOptions): Promise<void>;
  }
  
  interface FullscreenOptions {
    navigationUI?: 'auto' | 'hide' | 'show';
  }
  
  // For Android immersive mode via Cordova/Capacitor plugin
  interface Window {
    AndroidFullScreen?: {
      immersiveMode(successCallback: () => void, errorCallback: (error: any) => void): void;
    };
  }
}

export {};
