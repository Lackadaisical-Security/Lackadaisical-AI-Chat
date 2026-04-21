export interface Theme {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  colors: {
    // Background colors
    background: string;
    backgroundSecondary: string;
    backgroundTertiary: string;
    
    // Text colors
    text: string;
    textSecondary: string;
    textMuted: string;
    
    // Primary colors
    primary: string;
    primaryHover: string;
    primaryActive: string;
    
    // Accent colors
    accent: string;
    accentHover: string;
    
    // Status colors
    success: string;
    warning: string;
    error: string;
    info: string;
    
    // Chat specific
    userMessage: string;
    aiMessage: string;
    systemMessage: string;
    
    // UI elements
    border: string;
    borderLight: string;
    shadow: string;
    card: string;
    
    // Special effects
    highlight: string;
    selection: string;
    focus: string;
  };
  typography: {
    fontFamily: string;
    fontFamilyMono: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
    };
    fontWeight: {
      normal: string;
      medium: string;
      semibold: string;
      bold: string;
    };
    lineHeight: {
      tight: string;
      normal: string;
      relaxed: string;
    };
  };
  animations: {
    transition: string;
    transitionFast: string;
    transitionSlow: string;
    bounce: string;
    pulse: string;
    fadeIn: string;
    slideIn: string;
  };
  effects: {
    blur: string;
    blurLight: string;
    blurHeavy: string;
    glassmorphism: string;
    gradient: string;
    noise?: string;
    scanlines?: string;
  };
  accessibility: {
    highContrast: boolean;
    reducedMotion: boolean;
    largeText: boolean;
    screenReaderOptimized: boolean;
  };
}

export const themes: Record<string, Theme> = {
  light: {
    id: 'light',
    name: 'Light Mode',
    description: 'Clean and minimal light theme',
    author: 'Lackadaisical Security',
    version: '2.0.0-rc1',
    colors: {
      background: '#ffffff',
      backgroundSecondary: '#f8fafc',
      backgroundTertiary: '#f1f5f9',
      text: '#1e293b',
      textSecondary: '#475569',
      textMuted: '#64748b',
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      primaryActive: '#1d4ed8',
      accent: '#8b5cf6',
      accentHover: '#7c3aed',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#06b6d4',
      userMessage: '#3b82f6',
      aiMessage: '#6b7280',
      systemMessage: '#8b5cf6',
      border: '#e2e8f0',
      borderLight: '#f1f5f9',
      shadow: 'rgba(0, 0, 0, 0.1)',
      card: '#ffffff',
      highlight: '#fef3c7',
      selection: '#bfdbfe',
      focus: '#93c5fd'
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontFamilyMono: 'JetBrains Mono, Monaco, monospace',
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem'
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700'
      },
      lineHeight: {
        tight: '1.25',
        normal: '1.5',
        relaxed: '1.75'
      }
    },
    animations: {
      transition: 'all 0.2s ease-in-out',
      transitionFast: 'all 0.1s ease-in-out',
      transitionSlow: 'all 0.3s ease-in-out',
      bounce: 'bounce 1s infinite',
      pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      fadeIn: 'fadeIn 0.3s ease-in-out',
      slideIn: 'slideInFromBottom 0.3s ease-out'
    },
    effects: {
      blur: 'blur(8px)',
      blurLight: 'blur(4px)',
      blurHeavy: 'blur(16px)',
      glassmorphism: 'rgba(255, 255, 255, 0.2)',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    accessibility: {
      highContrast: false,
      reducedMotion: false,
      largeText: false,
      screenReaderOptimized: true
    }
  },

  dark: {
    id: 'dark',
    name: 'Dark Mode',
    description: 'Sleek dark theme for night owls',
    author: 'Lackadaisical Security',
    version: '2.0.0-rc1',
    colors: {
      background: '#0f172a',
      backgroundSecondary: '#1e293b',
      backgroundTertiary: '#334155',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      primary: '#60a5fa',
      primaryHover: '#3b82f6',
      primaryActive: '#2563eb',
      accent: '#a78bfa',
      accentHover: '#8b5cf6',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      info: '#22d3ee',
      userMessage: '#60a5fa',
      aiMessage: '#94a3b8',
      systemMessage: '#a78bfa',
      border: '#475569',
      borderLight: '#334155',
      shadow: 'rgba(0, 0, 0, 0.3)',
      card: '#1e293b',
      highlight: '#fef3c7',
      selection: '#1e40af',
      focus: '#3b82f6'
    },
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontFamilyMono: 'JetBrains Mono, Monaco, monospace',
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem'
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700'
      },
      lineHeight: {
        tight: '1.25',
        normal: '1.5',
        relaxed: '1.75'
      }
    },
    animations: {
      transition: 'all 0.2s ease-in-out',
      transitionFast: 'all 0.1s ease-in-out',
      transitionSlow: 'all 0.3s ease-in-out',
      bounce: 'bounce 1s infinite',
      pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      fadeIn: 'fadeIn 0.3s ease-in-out',
      slideIn: 'slideInFromBottom 0.3s ease-out'
    },
    effects: {
      blur: 'blur(8px)',
      blurLight: 'blur(4px)',
      blurHeavy: 'blur(16px)',
      glassmorphism: 'rgba(0, 0, 0, 0.2)',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    accessibility: {
      highContrast: false,
      reducedMotion: false,
      largeText: false,
      screenReaderOptimized: true
    }
  },

  retro: {
    id: 'retro',
    name: '80s Retro Cyberspace',
    description: 'Neon-soaked cyberpunk vibes from the 80s',
    author: 'Lackadaisical Security',
    version: '2.0.0-rc1',
    colors: {
      background: '#0a0a0a',
      backgroundSecondary: '#1a0a1a',
      backgroundTertiary: '#2a1a2a',
      text: '#00ff00',
      textSecondary: '#ff00ff',
      textMuted: '#00ffff',
      primary: '#ff1493',
      primaryHover: '#ff69b4',
      primaryActive: '#dc143c',
      accent: '#00ffff',
      accentHover: '#40e0d0',
      success: '#00ff00',
      warning: '#ffff00',
      error: '#ff0000',
      info: '#00bfff',
      userMessage: '#ff1493',
      aiMessage: '#00ffff',
      systemMessage: '#ff00ff',
      border: '#ff00ff',
      borderLight: '#800080',
      shadow: 'rgba(255, 0, 255, 0.5)',
      card: '#1a0a1a',
      highlight: '#ffff00',
      selection: '#ff1493',
      focus: '#00ffff'
    },
    typography: {
      fontFamily: 'Orbitron, Monaco, monospace',
      fontFamilyMono: 'Fira Code, Monaco, monospace',
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem'
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700'
      },
      lineHeight: {
        tight: '1.25',
        normal: '1.5',
        relaxed: '1.75'
      }
    },
    animations: {
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      transitionFast: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      transitionSlow: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'neonBounce 1s infinite',
      pulse: 'neonPulse 2s infinite',
      fadeIn: 'neonFadeIn 0.5s ease-in-out',
      slideIn: 'glitchSlideIn 0.4s ease-out'
    },
    effects: {
      blur: 'blur(2px)',
      blurLight: 'blur(1px)',
      blurHeavy: 'blur(4px)',
      glassmorphism: 'rgba(255, 0, 255, 0.1)',
      gradient: 'linear-gradient(45deg, #ff1493, #00ffff, #ff00ff)',
      noise: 'url(#noise)',
      scanlines: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 0, 0.03) 2px, rgba(0, 255, 0, 0.03) 4px)'
    },
    accessibility: {
      highContrast: true,
      reducedMotion: false,
      largeText: false,
      screenReaderOptimized: true
    }
  },

  terminal: {
    id: 'terminal',
    name: '90s Terminal',
    description: 'Classic green-on-black terminal aesthetic',
    author: 'Lackadaisical Security',
    version: '2.0.0-rc1',
    colors: {
      background: '#000000',
      backgroundSecondary: '#001100',
      backgroundTertiary: '#002200',
      text: '#00ff00',
      textSecondary: '#00cc00',
      textMuted: '#009900',
      primary: '#00ff00',
      primaryHover: '#33ff33',
      primaryActive: '#00cc00',
      accent: '#ffff00',
      accentHover: '#cccc00',
      success: '#00ff00',
      warning: '#ffff00',
      error: '#ff0000',
      info: '#00ffff',
      userMessage: '#00ff00',
      aiMessage: '#00cc00',
      systemMessage: '#ffff00',
      border: '#00ff00',
      borderLight: '#004400',
      shadow: 'rgba(0, 255, 0, 0.3)',
      card: '#001100',
      highlight: '#ffff00',
      selection: '#004400',
      focus: '#00ff00'
    },
    typography: {
      fontFamily: 'Courier New, Monaco, monospace',
      fontFamilyMono: 'Courier New, Monaco, monospace',
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem'
      },
      fontWeight: {
        normal: '400',
        medium: '400',
        semibold: '700',
        bold: '700'
      },
      lineHeight: {
        tight: '1.2',
        normal: '1.4',
        relaxed: '1.6'
      }
    },
    animations: {
      transition: 'all 0.1s linear',
      transitionFast: 'all 0.05s linear',
      transitionSlow: 'all 0.2s linear',
      bounce: 'terminalBlink 1s infinite',
      pulse: 'terminalFlicker 0.1s infinite',
      fadeIn: 'terminalType 0.5s ease-out',
      slideIn: 'terminalScroll 0.3s ease-out'
    },
    effects: {
      blur: 'blur(1px)',
      blurLight: 'blur(0.5px)',
      blurHeavy: 'blur(2px)',
      glassmorphism: 'rgba(0, 255, 0, 0.05)',
      gradient: 'linear-gradient(180deg, #00ff00, #004400)',
      scanlines: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0, 255, 0, 0.1) 1px, rgba(0, 255, 0, 0.1) 2px)'
    },
    accessibility: {
      highContrast: true,
      reducedMotion: false,
      largeText: false,
      screenReaderOptimized: true
    }
  },

  matrix: {
    id: 'matrix',
    name: 'Matrix',
    description: 'Enter the Matrix with this iconic green rain theme',
    author: 'Lackadaisical Security',
    version: '2.0.0-rc1',
    colors: {
      background: '#000000',
      backgroundSecondary: '#0d1117',
      backgroundTertiary: '#1a1a1a',
      text: '#00ff41',
      textSecondary: '#00dd00',
      textMuted: '#008f11',
      primary: '#00ff41',
      primaryHover: '#39ff14',
      primaryActive: '#00cc00',
      accent: '#00ff00',
      accentHover: '#33ff33',
      success: '#00ff41',
      warning: '#ffff00',
      error: '#ff0000',
      info: '#00ffff',
      userMessage: '#00ff41',
      aiMessage: '#00dd00',
      systemMessage: '#00ff00',
      border: '#00ff41',
      borderLight: '#003300',
      shadow: 'rgba(0, 255, 65, 0.4)',
      card: '#0d1117',
      highlight: '#39ff14',
      selection: '#003300',
      focus: '#00ff41'
    },
    typography: {
      fontFamily: 'Matrix Code NFI, Courier New, monospace',
      fontFamilyMono: 'Matrix Code NFI, Fira Code, monospace',
      fontSize: {
        xs: '0.75rem',
        sm: '0.875rem',
        base: '1rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem'
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700'
      },
      lineHeight: {
        tight: '1.2',
        normal: '1.4',
        relaxed: '1.6'
      }
    },
    animations: {
      transition: 'all 0.2s ease-in-out',
      transitionFast: 'all 0.1s ease-in-out',
      transitionSlow: 'all 0.4s ease-in-out',
      bounce: 'matrixGlow 2s infinite',
      pulse: 'matrixPulse 3s infinite',
      fadeIn: 'matrixDigitalRain 1s ease-in-out',
      slideIn: 'matrixSlide 0.5s ease-out'
    },
    effects: {
      blur: 'blur(1px)',
      blurLight: 'blur(0.5px)',
      blurHeavy: 'blur(3px)',
      glassmorphism: 'rgba(0, 255, 65, 0.1)',
      gradient: 'linear-gradient(180deg, #00ff41 0%, #003300 100%)',
      noise: 'url(#digitalNoise)',
      scanlines: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 65, 0.05) 2px, rgba(0, 255, 65, 0.05) 4px)'
    },
    accessibility: {
      highContrast: true,
      reducedMotion: false,
      largeText: false,
      screenReaderOptimized: true
    }
  }
};

export const defaultTheme = 'light';

export const getTheme = (themeId: string): Theme => {
  return themes[themeId] || themes[defaultTheme];
};

export const getAvailableThemes = (): Array<{id: string; name: string; description: string}> => {
  return Object.values(themes).map(theme => ({
    id: theme.id,
    name: theme.name,
    description: theme.description
  }));
};
