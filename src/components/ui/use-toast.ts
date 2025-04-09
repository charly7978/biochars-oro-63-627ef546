
// Re-export completely disabled toast hooks per user's request
export const useToast = () => ({
  toasts: [],
  toast: () => ({ id: "", dismiss: () => {}, update: () => {} }),
  dismiss: () => {}
});

export const toast = () => ({
  id: "",
  dismiss: () => {},
  update: () => {}
});
