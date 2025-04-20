import React, { createContext, useContext } from "react";
import { useOpenCVStatus } from "@/hooks/useOpenCVStatus";

interface OpenCVContextValue {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  retry: () => void;
}

const OpenCVContext = createContext<OpenCVContextValue | undefined>(undefined);

export const OpenCVProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, error, retry } = useOpenCVStatus();

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-blue-600">
        Cargando OpenCV...
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-red-600">
        <div>Error al cargar OpenCV: {error}</div>
        <button onClick={retry} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">
          Reintentar
        </button>
      </div>
    );
  }
  if (status !== "ready") {
    return null;
  }

  return (
    <OpenCVContext.Provider value={{ status, error, retry }}>
      {children}
    </OpenCVContext.Provider>
  );
};

export function useOpenCV() {
  const ctx = useContext(OpenCVContext);
  if (!ctx) throw new Error("useOpenCV debe usarse dentro de <OpenCVProvider>");
  return ctx;
} 