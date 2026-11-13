/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        primary: { DEFAULT: '#108E69', soft: '#20B88A' },
        clinical: { DEFAULT: '#0D9488', soft: '#45C7AD' },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#FB7185',
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'Outfit', 'sans-serif'],
        sans: ['Inter', '"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
