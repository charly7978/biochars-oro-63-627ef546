
import { toast } from "@/hooks/use-toast";

export type ToastType = 'success' | 'error' | 'info';

// Modified to never show toasts regardless of parameters
export const showToast = (
  title: string, 
  description?: string, 
  type: ToastType = 'info',
  options?: { 
    duration?: number, 
    important?: boolean 
  }
) => {
  // Return null instead of showing toasts
  return null;
};

export const commonToasts = {
  auth: {
    signInSuccess: () => null,
    signUpSuccess: () => null, // Added this back to fix Auth.tsx error
    authError: () => null,
  },
  
  sharing: {
    linkShared: () => null,
    linkCopied: () => null,
    shareError: () => null,
  },
  
  system: {
    criticalError: (message?: string) => null,
    recoveryStarted: () => null,
  }
};
