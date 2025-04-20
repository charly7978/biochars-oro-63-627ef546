import { useState, useEffect, useCallback } from "react";

type OpenCVStatus = "idle" | "loading" | "ready" | "error";

function waitForOpenCVReady(timeout = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      if ((window as any).cv && (window as any).cv['ready']) {
        resolve();
      } else if (Date.now() - start > timeout) {
        reject(new Error("Timeout esperando OpenCV"));
      } else {
        setTimeout(check, 100);
      }
    }
    check();
  });
}

export function useOpenCVStatus() {
  const [status, setStatus] = useState<OpenCVStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      await waitForOpenCVReady();
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    initialize();
    // Solo inicializa una vez al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, error, retry: initialize };
} 