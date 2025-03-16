
export const animations = {
  "heart-beat": "heart-beat 1s ease-in-out infinite",
  "flip": "card-flip 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards",
  "value-glow": "value-glow 3s ease-in-out infinite",
  "dark-glow": "dark-glow 3s ease-in-out infinite",
  "arrhythmia-pulse": "arrhythmia-pulse 1.5s ease-in-out infinite",
  "vital-update": "vital-sign-update 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards",
  "data-pulse": "data-pulse 3s ease-in-out infinite",
  "fade-in-up": "fade-in-up 0.5s ease-out forwards",
  "subtle-pulse": "subtle-pulse 3s ease-in-out infinite",
  
  /* Optimized animation with reduced motion alternatives */
  "efficient-pulse": {
    value: "subtle-pulse 3s ease-in-out infinite",
    "prefers-reduced-motion": "none"
  },
  "efficient-fade": {
    value: "fade-in-up 0.4s cubic-bezier(0.2, 0, 0, 1) forwards",
    "prefers-reduced-motion": "none" 
  },
  "efficient-beat": {
    value: "heart-beat 1s cubic-bezier(0.2, 0, 0.4, 1) infinite",
    "prefers-reduced-motion": "none"
  },
  "efficient-update": {
    value: "vital-sign-update 0.4s cubic-bezier(0.2, 0, 0.2, 1) forwards",
    "prefers-reduced-motion": "none"
  }
};
