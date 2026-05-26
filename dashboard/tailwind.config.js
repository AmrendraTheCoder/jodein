/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        // Deep dark base palette
        dark: {
          950: '#020408',
          900: '#06090f',
          850: '#0a0f1a',
          800: '#0d1424',
          750: '#111828',
          700: '#151e30',
          600: '#1a2540',
        },
        // Indigo/violet primary
        brand: {
          50: '#f0f0ff',
          100: '#e0e0ff',
          200: '#c4c2ff',
          300: '#a99bff',
          400: '#8b73f5',
          500: '#6d51e8',
          600: '#5538d4',
          700: '#4228b8',
          800: '#311d96',
          900: '#221578',
        },
        // Emerald success
        success: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        // Amber warning
        warn: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Rose error
        danger: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
        // Cyan accent
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
      },
      backgroundImage: {
        'glow-indigo': 'radial-gradient(ellipse at center, rgba(109,81,232,0.15) 0%, transparent 70%)',
        'glow-emerald': 'radial-gradient(ellipse at center, rgba(16,185,129,0.12) 0%, transparent 70%)',
        'glow-cyan': 'radial-gradient(ellipse at center, rgba(6,182,212,0.12) 0%, transparent 70%)',
        'mesh-dark': 'linear-gradient(to bottom right, #020408, #06090f, #0a0f1a)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
        'hero-gradient': 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(109,81,232,0.2) 0%, transparent 70%)',
      },
      boxShadow: {
        'glow-sm': '0 0 15px rgba(109,81,232,0.25)',
        'glow-md': '0 0 30px rgba(109,81,232,0.3)',
        'glow-lg': '0 0 60px rgba(109,81,232,0.25)',
        'glow-emerald': '0 0 30px rgba(16,185,129,0.25)',
        'glow-cyan': '0 0 30px rgba(6,182,212,0.25)',
        'card': '0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04) inset',
        'card-hover': '0 8px 40px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.06) inset',
        'glass': '0 8px 32px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.06)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 10s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
        'slide-up': 'slide-up 0.5s ease-out',
        'slide-in-right': 'slide-in-right 0.4s ease-out',
        'fade-in': 'fade-in 0.6s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'scan': 'scan 3s linear infinite',
        'typing': 'typing 1.5s steps(3, end) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(109,81,232,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(109,81,232,0.6)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        typing: {
          '0%': { width: '0' },
          '33%': { width: '6px' },
          '66%': { width: '12px' },
          '100%': { width: '18px' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
    },
  },
  plugins: [],
}
