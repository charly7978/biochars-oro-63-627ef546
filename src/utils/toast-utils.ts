
import { toast } from "@/hooks/use-toast";

export type ToastType = 'success' | 'error' | 'info';

export const showToast = (
  title: string, 
  description?: string, 
  type: ToastType = 'info',
  options?: { 
    duration?: number, 
    important?: boolean 
  }
) => {
  // Only show toast if it's an important notification or an error
  if (options?.important || type === 'error') {
    return toast({
      title,
      description,
      variant: type === 'error' ? 'destructive' : 'default',
      duration: type === 'error' ? 5000 : (options?.duration || 2000),
    });
  }
};

export const commonToasts = {
  auth: {
    signInSuccess: () => null, // Removed toast for login
    authError: () => showToast('Error de autenticación', undefined, 'error', { important: true }),
  },
  
  sharing: {
    linkShared: () => null, // Removed toast for sharing
    linkCopied: () => null, // Removed toast for copying
    shareError: () => showToast('Error al compartir', undefined, 'error', { important: true }),
  },
  
  system: {
    criticalError: (message?: string) => showToast(
      'Error del Sistema', 
      message, 
      'error', 
      { important: true }
    ),
    recoveryStarted: () => null, // Removed recovery toast
  }
};
