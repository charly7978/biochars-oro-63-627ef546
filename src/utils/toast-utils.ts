import { toast } from "@/hooks/use-toast";

// Toast types for consistency
export type ToastType = 'success' | 'error' | 'info';

/**
 * Centralized toast notification utility to maintain consistent
 * toast appearance and behavior across the application
 */
export const showToast = (
  title: string, 
  description?: string, 
  type: ToastType = 'info'
) => {
  return toast({
    title,
    description,
    variant: type === 'error' ? 'destructive' : 'default',
    // Keep toast duration brief for non-critical notifications
    duration: type === 'error' ? 5000 : 3000,
  });
};

// Common toast messages to avoid duplication
export const commonToasts = {
  // Authentication related toasts
  auth: {
    signUpSuccess: () => showToast('Registro exitoso'),
    signInSuccess: () => showToast('Sesión iniciada'),
    authError: () => showToast('Error de autenticación', undefined, 'error'),
  },
  
  // Sharing related toasts
  sharing: {
    linkShared: () => showToast('Enlace compartido'),
    linkCopied: () => showToast('Enlace copiado'),
    shareError: () => showToast('Error al compartir', undefined, 'error'),
  },
  
  // System related toasts - only showing critical issues
  system: {
    criticalError: (message?: string) => showToast(
      'Error del Sistema', 
      message, 
      'error'
    ),
    recoveryStarted: () => showToast('Recuperación Iniciada'),
  }
};
