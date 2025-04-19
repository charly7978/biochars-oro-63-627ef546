
/**
 * Servicio para cargar y gestionar OpenCV.js
 */

// Define el tipo para OpenCV global
declare global {
  interface Window {
    cv: any;
  }
}

class OpenCVService {
  private static instance: OpenCVService;
  private isLoaded: boolean = false;
  private loadingPromise: Promise<void> | null = null;
  private readonly OPENCV_URL = 'https://docs.opencv.org/4.7.0/opencv.js';

  private constructor() {}

  public static getInstance(): OpenCVService {
    if (!OpenCVService.instance) {
      OpenCVService.instance = new OpenCVService();
    }
    return OpenCVService.instance;
  }

  /**
   * Carga OpenCV.js dinámicamente
   */
  public loadOpenCV(): Promise<void> {
    if (this.isLoaded) {
      return Promise.resolve();
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = new Promise<void>((resolve, reject) => {
      // Si ya está cargado, resolvemos inmediatamente
      if (window.cv) {
        this.isLoaded = true;
        console.log('OpenCV.js ya estaba cargado');
        resolve();
        return;
      }

      console.log('Cargando OpenCV.js...');
      
      const script = document.createElement('script');
      script.setAttribute('async', 'true');
      script.setAttribute('src', this.OPENCV_URL);
      
      script.onload = () => {
        // OpenCV.js se carga pero requiere inicialización
        if (window.cv) {
          // cv.onRuntimeInitialized es un callback específico de OpenCV.js
          // que se ejecuta cuando la biblioteca está completamente inicializada
          const prevInitializedCallback = window.cv.onRuntimeInitialized;
          window.cv.onRuntimeInitialized = () => {
            if (prevInitializedCallback) prevInitializedCallback();
            this.isLoaded = true;
            console.log('OpenCV.js cargado e inicializado correctamente');
            resolve();
          };
        } else {
          const error = new Error('OpenCV.js se cargó pero no se encontró el objeto cv global');
          console.error(error);
          reject(error);
        }
      };
      
      script.onerror = (error) => {
        const errorMsg = 'Error al cargar OpenCV.js';
        console.error(errorMsg, error);
        this.loadingPromise = null;
        reject(new Error(errorMsg));
      };
      
      document.head.appendChild(script);
    });

    return this.loadingPromise;
  }

  /**
   * Verifica si OpenCV.js está cargado
   */
  public isOpenCVLoaded(): boolean {
    return this.isLoaded && !!window.cv;
  }

  /**
   * Obtiene el objeto OpenCV
   */
  public getCV(): any {
    if (!this.isOpenCVLoaded()) {
      throw new Error('OpenCV.js no está cargado. Llame a loadOpenCV() primero.');
    }
    return window.cv;
  }
}

export default OpenCVService.getInstance();
