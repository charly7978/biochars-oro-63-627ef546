import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback
} from 'react';
import { EventType, eventBus, useEventSubscription } from '../modules/events/EventBus';
import { CameraConfig } from '../modules/types/signal';

/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

interface VitalSignsContextProps {
  heartbeatData: {
    lastHeartbeat: number | null;
    bpm: number | null;
  };
  setHeartbeatData: React.Dispatch<React.SetStateAction<{
    lastHeartbeat: number | null;
    bpm: number | null;
  }>>;
  cameraConfig: CameraConfig;
  setCameraConfig: React.Dispatch<React.SetStateAction<CameraConfig>>;
  isCameraActive: boolean;
  setIsCameraActive: React.Dispatch<React.SetStateAction<boolean>>;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  startMonitoring: () => void;
  stopMonitoring: () => void;
}

const VitalSignsContext = createContext<VitalSignsContextProps>({
  heartbeatData: {
    lastHeartbeat: null,
    bpm: null,
  },
  setHeartbeatData: () => {},
  cameraConfig: {
    width: 640,
    height: 480,
    fps: 30,
    facingMode: 'user',
  },
  setCameraConfig: () => {},
  isCameraActive: false,
  setIsCameraActive: () => {},
  isProcessing: false,
  setIsProcessing: () => {},
  startMonitoring: () => {},
  stopMonitoring: () => {},
});

interface VitalSignsProviderProps {
  children: React.ReactNode;
}

export const VitalSignsProvider: React.FC<VitalSignsProviderProps> = ({ children }) => {
  const [heartbeatData, setHeartbeatData] = useState({
    lastHeartbeat: null,
    bpm: null,
  });
  const [cameraConfig, setCameraConfig] = useState<CameraConfig>({
    width: 640,
    height: 480,
    fps: 30,
    facingMode: 'user',
  });
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    console.log("VitalSignsContext: Inicializado", {
      configuraciónInicial: cameraConfig,
      timestamp: new Date().toISOString()
    });

    return () => {
      console.log("VitalSignsContext: Desmontado", {
        estadoFinal: {
          cámaraActiva: isCameraActive,
          procesando: isProcessing
        },
        timestamp: new Date().toISOString()
      });
    };
  }, [cameraConfig, isCameraActive, isProcessing]);

  useEventSubscription(EventType.HEARTBEAT_PEAK_DETECTED, (data: any) => {
    setHeartbeatData(prev => {
      const newData = {
        ...prev,
        lastHeartbeat: Date.now(),
        bpm: data.bpm || prev.bpm
      };
      return newData;
    });
  });

  const startMonitoring = useCallback(() => {
    setIsProcessing(true);
    eventBus.publish(EventType.MONITORING_STARTED, {
      timestamp: Date.now(),
      configuración: cameraConfig
    });
    console.log("VitalSignsContext: Monitoreo iniciado", {
      configuración: cameraConfig,
      timestamp: new Date().toISOString()
    });
  }, [cameraConfig]);

  const stopMonitoring = useCallback(() => {
    setIsProcessing(false);
    eventBus.publish(EventType.MONITORING_STOPPED, {
      timestamp: Date.now()
    });
    console.log("VitalSignsContext: Monitoreo detenido", {
      timestamp: new Date().toISOString()
    });
  }, []);

  const value: VitalSignsContextProps = {
    heartbeatData,
    setHeartbeatData,
    cameraConfig,
    setCameraConfig,
    isCameraActive,
    setIsCameraActive,
    isProcessing,
    setIsProcessing,
    startMonitoring,
    stopMonitoring,
  };

  return (
    <VitalSignsContext.Provider value={value}>
      {children}
    </VitalSignsContext.Provider>
  );
};

export const useVitalSigns = () => {
  return useContext(VitalSignsContext);
};

/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */
