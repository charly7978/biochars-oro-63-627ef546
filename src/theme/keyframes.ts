
export const keyframes = {
  "heart-beat": {
    "0%, 100%": { transform: "scale(1)" },
    "50%": { transform: "scale(1.1)" },
  },
  "card-flip": {
    "0%": { 
      transform: "rotateY(0deg)",
    },
    "100%": { 
      transform: "rotateY(180deg)",
    }
  },
  "progress": {
    "0%": { transform: "translateX(-100%)" },
    "50%": { transform: "translateX(100%)" },
    "100%": { transform: "translateX(-100%)" }
  },
  "equalize": {
    "0%, 100%": { height: "2rem" },
    "50%": { height: "0.5rem" }
  },
  "value-glow": {
    "0%, 100%": { textShadow: "0 0 2px rgba(255,255,255,0.3)" },
    "50%": { textShadow: "0 0 25px rgba(255,255,255,0.9), 0 0 15px rgba(255,255,255,0.7)" }
  },
  "arrhythmia-pulse": {
    "0%": { transform: "scale(1)", opacity: "0.9" },
    "50%": { transform: "scale(1.15)", opacity: "0.8" },
    "100%": { transform: "scale(1)", opacity: "0.9" }
  },
  "dark-glow": {
    "0%, 100%": { textShadow: "0 0 2px rgba(180,200,255,0.3)" },
    "50%": { textShadow: "0 0 25px rgba(140,180,255,0.9), 0 0 15px rgba(120,160,255,0.6)" }
  },
  // Optimized animations with reduced changes
  "vital-sign-update": {
    "0%": { transform: "scale(0.98)", opacity: "0.9" },
    "100%": { transform: "scale(1)", opacity: "1" }
  },
  "data-pulse": {
    "0%": { opacity: "0.9" },
    "50%": { opacity: "1" },
    "100%": { opacity: "0.9" }
  },
  "fade-in-up": {
    "0%": { opacity: "0", transform: "translateY(8px)" },
    "100%": { opacity: "1", transform: "translateY(0)" }
  },
  "subtle-pulse": {
    "0%, 100%": { opacity: "0.95", textShadow: "0 0 3px rgba(255,255,255,0.2)" },
    "50%": { opacity: "1", textShadow: "0 0 12px rgba(255,255,255,0.4), 0 0 4px rgba(255,255,255,0.3)" }
  }
};
