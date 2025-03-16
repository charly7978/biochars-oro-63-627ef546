
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
        }
      },
      animation: {
        "heart-beat": "heart-beat 1s ease-in-out infinite",
        "flip": "card-flip 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "value-glow": "value-glow 3s ease-in-out infinite",
        "arrhythmia-pulse": "arrhythmia-pulse 1.5s ease-in-out infinite"
      }
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
        '.ultra-crisp-graphics': {
          'image-rendering': '-webkit-optimize-contrast',
          'image-rendering': 'crisp-edges',
          'shape-rendering': 'crispEdges',
          'transform': 'translate3d(0, 0, 0)',
          'backface-visibility': 'hidden'
        }
      }
      addUtilities(newUtilities)
    }
  ],
} satisfies Config;
