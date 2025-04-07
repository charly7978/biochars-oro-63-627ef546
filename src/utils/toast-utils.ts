
// This file is intentionally empty to disable all toast functionality
export type ToastType = 'success' | 'error' | 'info';

// Completely disabled toast function
export const showToast = () => null;

// Completely disabled common toasts
export const commonToasts = {
  auth: {
    signInSuccess: () => null,
    signUpSuccess: () => null,
    authError: () => null,
  },
  
  sharing: {
    linkShared: () => null,
    linkCopied: () => null,
    shareError: () => null,
  },
  
  system: {
    criticalError: () => null,
    recoveryStarted: () => null,
  }
};
