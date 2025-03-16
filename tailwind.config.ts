
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        medical: {
          red: "#FF2E2E",
          blue: "#2E5BFF",
          lilac: "#A098E8",
          "lilac-light": "#E0D9FF",
          "dark-red": "#FF4C5E",
          "dark-blue": "#5A9BFF",
          "dark-lilac": "#B8ACFF",
          "dark-panel": "#1A1F2C",
          "dark-card": "#222532",
          "dark-accent": "#2A3042",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontSize: {
        'display-large': ['2.5rem', { lineHeight: '3rem', fontWeight: '700' }],
        'display-medium': ['2rem', { lineHeight: '2.5rem', fontWeight: '700' }],
        'display-small': ['1.75rem', { lineHeight: '2.25rem', fontWeight: '600' }],
        'value-large': ['2rem', { lineHeight: '2.5rem', fontWeight: '600' }],
        'value-medium': ['1.75rem', { lineHeight: '2.25rem', fontWeight: '600' }],
        'value-small': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
      },
      keyframes: {
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
          "0%, 100%": { textShadow: "0 0 1px rgba(255,255,255,0.2)" },
          "50%": { textShadow: "0 0 20px rgba(255,255,255,0.9), 0 0 10px rgba(255,255,255,0.6)" }
        },
        "arrhythmia-pulse": {
          "0%": { transform: "scale(1)", opacity: "0.9" },
          "50%": { transform: "scale(1.15)", opacity: "0.8" },
          "100%": { transform: "scale(1)", opacity: "0.9" }
        },
        "dark-glow": {
          "0%, 100%": { textShadow: "0 0 1px rgba(180,200,255,0.2)" },
          "50%": { textShadow: "0 0 20px rgba(140,180,255,0.9), 0 0 10px rgba(120,160,255,0.6)" }
        },
      },
      animation: {
        "heart-beat": "heart-beat 1s ease-in-out infinite",
        "flip": "card-flip 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "value-glow": "value-glow 3s ease-in-out infinite",
        "dark-glow": "dark-glow 3s ease-in-out infinite",
        "arrhythmia-pulse": "arrhythmia-pulse 1.5s ease-in-out infinite"
      },
      screens: {
        '2k': '2048px',
        '4k': '3840px',
        '5k': '5120px',
        '8k': '7680px',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    function({ addUtilities }) {
      const newUtilities = {
        '.text-gradient-soft': {
          background: 'linear-gradient(to bottom, #FFFFFF, #F2FCE2)',
          '-webkit-background-clip': 'text',
          'background-clip': 'text',
          'color': 'transparent',
          'text-shadow': '0 0 5px rgba(255,255,255,0.3)'
        },
        '.dark .text-gradient-soft': {
          background: 'linear-gradient(to bottom, #FFFFFF, #E0E8FF)',
          '-webkit-background-clip': 'text',
          'background-clip': 'text',
          'color': 'transparent',
          'text-shadow': '0 0 5px rgba(160,190,255,0.4)'
        },
        '.ultra-high-resolution': {
          'image-rendering': 'high-quality',
          'backface-visibility': 'hidden',
          'transform': 'translate3d(0, 0, 0)',
          'will-change': 'transform',
          'contain': 'strict',
          'text-rendering': 'geometricPrecision'
        },
        '.super-crisp-text': {
          'text-rendering': 'geometricPrecision',
          '-webkit-font-smoothing': 'antialiased',
          'font-feature-settings': '"kern", "liga", "calt", "pnum", "tnum"',
          'font-variant-numeric': 'tabular-nums',
          'letter-spacing': '-0.01em'
        },
        '.dark .super-crisp-text': {
          'text-rendering': 'geometricPrecision',
          '-webkit-font-smoothing': 'antialiased',
          'font-feature-settings': '"kern", "liga", "calt", "pnum", "tnum"',
          'font-variant-numeric': 'tabular-nums',
          'letter-spacing': '0.01em'
        },
        '.ultra-crisp-graphics': {
          'image-rendering': '-webkit-optimize-contrast',
          'image-rendering': 'crisp-edges',
          'shape-rendering': 'crispEdges',
          'transform': 'translate3d(0, 0, 0)',
          'backface-visibility': 'hidden'
        },
        '.gpu-accelerated': {
          'transform': 'translateZ(0)',
          'backface-visibility': 'hidden',
          'will-change': 'transform',
          'contain': 'paint layout style'
        },
        '.high-res-text': {
          'text-rendering': 'geometricPrecision',
          '-webkit-font-smoothing': 'antialiased',
          'font-feature-settings': '"kern", "liga", "calt"',
          'letter-spacing': '-0.01em'
        },
        '.dark .high-res-text': {
          'letter-spacing': '0.01em'
        },
        // Glassmorphism utilities
        '.glass': {
          'background': 'rgba(255, 255, 255, 0.08)',
          'backdrop-filter': 'blur(12px)',
          '-webkit-backdrop-filter': 'blur(12px)',
          'border': '1px solid rgba(255, 255, 255, 0.12)',
          'box-shadow': '0 4px 30px rgba(0, 0, 0, 0.1)'
        },
        '.dark .glass': {
          'background': 'rgba(30, 30, 40, 0.25)',
          'backdrop-filter': 'blur(14px)',
          '-webkit-backdrop-filter': 'blur(14px)',
          'border': '1px solid rgba(70, 70, 90, 0.2)',
          'box-shadow': '0 4px 30px rgba(0, 0, 0, 0.35)'
        },
        '.glass-dark': {
          'background': 'rgba(20, 20, 28, 0.65)',
          'backdrop-filter': 'blur(12px)',
          '-webkit-backdrop-filter': 'blur(12px)',
          'border': '1px solid rgba(255, 255, 255, 0.08)',
          'box-shadow': '0 4px 30px rgba(0, 0, 0, 0.2)'
        },
        '.dark .glass-dark': {
          'background': 'rgba(15, 15, 20, 0.75)',
          'backdrop-filter': 'blur(12px)',
          '-webkit-backdrop-filter': 'blur(12px)',
          'border': '1px solid rgba(255, 255, 255, 0.06)',
          'box-shadow': '0 4px 30px rgba(0, 0, 0, 0.3)'
        },
        '.glass-card': {
          'background': 'rgba(255, 255, 255, 0.06)',
          'backdrop-filter': 'blur(10px)',
          '-webkit-backdrop-filter': 'blur(10px)',
          'border-radius': '16px', 
          'border': '1px solid rgba(255, 255, 255, 0.1)',
          'box-shadow': '0 4px 30px rgba(0, 0, 0, 0.1)'
        },
        '.dark .glass-card': {
          'background': 'rgba(25, 25, 35, 0.3)',
          'backdrop-filter': 'blur(12px)',
          '-webkit-backdrop-filter': 'blur(12px)',
          'border': '1px solid rgba(70, 70, 90, 0.15)',
          'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.25)'
        },
        '.glass-card-dark': {
          'background': 'rgba(20, 20, 28, 0.55)',
          'backdrop-filter': 'blur(10px)',
          '-webkit-backdrop-filter': 'blur(10px)', 
          'border-radius': '16px',
          'border': '1px solid rgba(255, 255, 255, 0.05)',
          'box-shadow': '0 4px 30px rgba(0, 0, 0, 0.25)'
        },
        '.dark .glass-card-dark': {
          'background': 'rgba(15, 15, 22, 0.65)',
          'backdrop-filter': 'blur(12px)',
          '-webkit-backdrop-filter': 'blur(12px)', 
          'border': '1px solid rgba(60, 65, 90, 0.12)',
          'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.35)'
        },
        '.glass-medical': {
          'background': 'rgba(240, 248, 255, 0.1)',
          'backdrop-filter': 'blur(15px)',
          '-webkit-backdrop-filter': 'blur(15px)',
          'border': '1px solid rgba(240, 248, 255, 0.15)',
          'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.15)'
        },
        '.dark .glass-medical': {
          'background': 'rgba(20, 25, 35, 0.45)',
          'backdrop-filter': 'blur(15px)',
          '-webkit-backdrop-filter': 'blur(15px)',
          'border': '1px solid rgba(50, 60, 80, 0.2)',
          'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.25)'
        },
        '.inner-glow': {
          'box-shadow': 'inset 0 0 15px rgba(255, 255, 255, 0.15)'
        },
        '.dark .inner-glow': {
          'box-shadow': 'inset 0 0 15px rgba(120, 130, 180, 0.2)'
        },
        '.depth-layer': {
          'position': 'relative',
          'z-index': '1'
        },
        '.depth-layer-2': {
          'position': 'relative',
          'z-index': '2'
        },
        // New medical context-aware contrast classes
        '.medical-critical': {
          'color': '#ea384c'
        },
        '.dark .medical-critical': {
          'color': '#ff4c5e' // Brighter in dark mode for contrast
        },
        '.medical-warning': {
          'color': '#f97316'
        },
        '.dark .medical-warning': {
          'color': '#ff9c40' // Brighter in dark mode for contrast
        },
        '.medical-normal': {
          'color': '#22c55e'
        },
        '.dark .medical-normal': {
          'color': '#34d872' // Brighter in dark mode for contrast
        },
        '.medical-info': {
          'color': '#3b82f6'
        },
        '.dark .medical-info': {
          'color': '#5a9bff' // Brighter in dark mode for contrast
        }
      }
      addUtilities(newUtilities)
    }
  ],
} satisfies Config;
