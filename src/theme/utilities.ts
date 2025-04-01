export const utilities = function({ addUtilities }) {
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
    // Medical context-aware contrast classes
    '.medical-critical': {
      'color': 'var(--medical-danger)'
    },
    '.dark .medical-critical': {
      'color': 'var(--medical-danger-dark)' 
    },
    '.medical-warning': {
      'color': 'var(--medical-warning)'
    },
    '.dark .medical-warning': {
      'color': 'var(--medical-warning-dark)' 
    },
    '.medical-normal': {
      'color': 'var(--medical-success)'
    },
    '.dark .medical-normal': {
      'color': 'var(--medical-success-dark)' 
    },
    '.medical-info': {
      'color': 'var(--medical-info)'
    },
    '.dark .medical-info': {
      'color': 'var(--medical-info-dark)' 
    },
    // Nuevas utilidades tipográficas
    '.typography-tabular': {
      'font-feature-settings': '"tnum", "salt", "ss01"',
      'font-variant-numeric': 'tabular-nums',
      'letter-spacing': '-0.01em',
      'text-rendering': 'optimizeLegibility'
    },
    '.typography-medical-data': {
      'font-feature-settings': '"tnum", "salt", "ss01", "cv01", "cv03"',
      'font-variant-numeric': 'tabular-nums',
      'letter-spacing': '-0.02em',
      'text-rendering': 'geometricPrecision',
      'font-weight': '500'
    },
    '.typography-clinical': {
      'font-feature-settings': '"kern", "liga", "calt", "pnum", "tnum"',
      'font-variant-numeric': 'tabular-nums',
      'letter-spacing': '-0.01em',
      'text-rendering': 'optimizeLegibility',
      '-webkit-font-smoothing': 'antialiased'
    },
    '.dark .typography-clinical': {
      'font-weight': '400',
      'letter-spacing': '0.01em'
    },
    // Nuevas utilidades de diseño Grid
    '.grid-auto-fit': {
      'display': 'grid',
      'grid-template-columns': 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
      'gap': '1rem'
    },
    '.grid-auto-fill': {
      'display': 'grid',
      'grid-template-columns': 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))',
      'gap': '1rem'
    },
    '.grid-dashboard': {
      'display': 'grid',
      'grid-template-columns': 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))',
      'grid-auto-rows': 'minmax(180px, auto)',
      'gap': '1.25rem',
      'contain': 'layout style'
    },
    '.grid-vital-signs': {
      'display': 'grid',
      'grid-template-columns': '1fr 1fr',
      'grid-template-rows': 'auto',
      'gap': '1rem',
      '@screen md': {
        'grid-template-columns': 'repeat(4, 1fr)'
      }
    },
    // Mejoras visuales para pantallas de alta resolución
    '.ultra-crisp-rendering': {
      'image-rendering': 'high-quality',
      'text-rendering': 'geometricPrecision',
      '-webkit-font-smoothing': 'antialiased',
      'will-change': 'transform, opacity',
      'backface-visibility': 'hidden',
      'transform': 'translate3d(0, 0, 0)',
      'contain': 'paint layout style'
    },
    '.dark .ultra-crisp-rendering': {
      'text-shadow': '0 0.5px 1px rgba(0, 0, 0, 0.3)'
    },
    // Animation optimizations with reduced motion support
    '.animate-fade-in': {
      'animation': 'fade-in-up 0.5s ease-out forwards',
      '@media (prefers-reduced-motion: reduce)': {
        'animation': 'none',
        'opacity': '1',
        'transform': 'translateY(0)'
      }
    },
    '.animate-subtle-pulse': {
      'animation': 'subtle-pulse 3s ease-in-out infinite',
      '@media (prefers-reduced-motion: reduce)': {
        'animation': 'none'
      }
    },
    '.animate-heart-beat': {
      'animation': 'heart-beat 1s ease-in-out infinite',
      '@media (prefers-reduced-motion: reduce)': {
        'animation': 'none',
        'transform': 'scale(1.05)'
      }
    },
    '.animate-vital-update': {
      'animation': 'vital-sign-update 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
      '@media (prefers-reduced-motion: reduce)': {
        'animation': 'none',
        'opacity': '1',
        'transform': 'scale(1)'
      }
    },
    '.animate-efficient-beat': {
      'animation': 'heart-beat 1s cubic-bezier(0.2, 0, 0.4, 1) infinite',
      '@media (prefers-reduced-motion: reduce)': {
        'animation': 'none',
        'transform': 'scale(1.05)'
      }
    },
    '.animate-efficient-pulse': {
      'animation': 'subtle-pulse 3s ease-in-out infinite',
      '@media (prefers-reduced-motion: reduce)': {
        'animation': 'none'
      }
    },
    '.animate-efficient-fade': {
      'animation': 'fade-in-up 0.4s cubic-bezier(0.2, 0, 0, 1) forwards',
      '@media (prefers-reduced-motion: reduce)': {
        'animation': 'none',
        'opacity': '1',
        'transform': 'translateY(0)'
      }
    },
    '.animate-efficient-update': {
      'animation': 'vital-sign-update 0.4s cubic-bezier(0.2, 0, 0.2, 1) forwards',
      '@media (prefers-reduced-motion: reduce)': {
        'animation': 'none',
        'opacity': '1',
        'transform': 'scale(1)'
      }
    },
    // Optimized animation utilities
    '.will-change-opacity': {
      'will-change': 'opacity'
    },
    '.will-change-transform': {
      'will-change': 'transform'
    },
    '.hardware-accelerated': {
      'transform': 'translateZ(0)',
      'will-change': 'transform',
      'backface-visibility': 'hidden',
      'perspective': '1000px'
    },
    
    // Design system spacing utilities
    '.space-xs': {
      'margin': 'var(--space-xs)',
      'padding': 'var(--space-xs)'
    },
    '.space-sm': {
      'margin': 'var(--space-sm)',
      'padding': 'var(--space-sm)'
    },
    '.space-md': {
      'margin': 'var(--space-md)',
      'padding': 'var(--space-md)'
    },
    '.space-lg': {
      'margin': 'var(--space-lg)',
      'padding': 'var(--space-lg)'
    },
    '.space-xl': {
      'margin': 'var(--space-xl)',
      'padding': 'var(--space-xl)'
    }
  };
  addUtilities(newUtilities);
};
