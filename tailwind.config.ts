import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Warm charcoal surfaces
        surface: {
          0: '#0d0c09',
          1: '#151210',
          2: '#1e1a16',
          3: '#26221d',
          4: '#2f2a24',
          5: '#3a342d',
        },
        // Burnt orange brand
        brand: {
          DEFAULT: '#e8622a',
          dim: '#b84d1f',
          glow: 'rgba(232,98,42,0.15)',
        },
        warn: '#f59e0b',
        danger: '#ef4444',
        success: '#10b981',
        // Subsystem semantic colours (unchanged — used as identifiers)
        chassis: '#4ade80',
        upright: '#fb923c',
        tieRod:  '#a78bfa',
        uca:     '#60a5fa',
        lca:     '#f472b6',
        shock:   '#facc15',
        pushrod: '#34d399',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Cal Sans', 'Inter', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'pulse-glow': {
          '0%,100%': { boxShadow: '0 0 4px rgba(232,98,42,0.4)' },
          '50%':      { boxShadow: '0 0 14px rgba(232,98,42,0.85)' },
        },
      },
      animation: {
        'fade-in':    'fade-in 0.15s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
