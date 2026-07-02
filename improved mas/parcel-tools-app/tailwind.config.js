/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark': {
          50: '#f0f6fc',
          100: '#c9d1d9',
          200: '#b1bac4',
          300: '#8b949e',
          400: '#6e7681',
          500: '#484f58',
          600: '#30363d',
          700: '#21262d',
          750: '#1a1f26',
          800: '#161b22',
          900: '#0d1117',
        },
        'primary': {
          DEFAULT: '#58a6ff',
          50: '#f0f8ff',
          100: '#e1f3ff',
          200: '#bee9ff',
          300: '#8dd5ff',
          400: '#58a6ff',
          500: '#1f6feb',
          600: '#0d7eff',
          700: '#0969da',
          800: '#0550ae',
          900: '#033d8b',
          light: '#79bcff',
          dark: '#0969da',
        },
        'accent': {
          DEFAULT: '#7c3aed',
          light: '#a78bfa',
          dark: '#5b21b6',
        },
        'success': {
          DEFAULT: '#3fb950',
          light: '#56d364',
          dark: '#2ea043',
        },
        'danger': {
          DEFAULT: '#f85149',
          light: '#ff7b72',
          dark: '#da3633',
        },
        'warning': {
          DEFAULT: '#d29922',
          light: '#e3b341',
          dark: '#bf8700',
        }
      },
      fontFamily: {
        'sans': ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'glow':       '0 0 20px rgba(88, 166, 255, 0.25)',
        'glow-lg':    '0 0 40px rgba(88, 166, 255, 0.35)',
        'glow-green': '0 0 20px rgba(63, 185, 80, 0.25)',
        'glass':      '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        'card':       '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 40px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'float':       'float 6s ease-in-out infinite',
        'pulse-glow':  'pulse-glow 2s ease-in-out infinite',
        'slide-up':    'slide-up 0.5s ease-out',
        'fade-in':     'fade-in 0.3s ease-out',
        'spin-slow':   'spin-slow 3s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(88, 166, 255, 0.25)' },
          '50%':       { boxShadow: '0 0 40px rgba(88, 166, 255, 0.50)' },
        },
        'slide-up': {
          '0%':   { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
}


