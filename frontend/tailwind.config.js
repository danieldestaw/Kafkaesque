/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sf: {
          bg: 'var(--sf-bg)',
          panel: 'var(--sf-panel)',
          border: 'var(--sf-border)',
          text: 'var(--sf-text)',
          muted: 'var(--sf-muted)',
          accent: 'var(--sf-accent)',
          danger: '#dc2626',
          success: '#16a34a',
          warn: '#d97706',
        },
      },
    },
  },
  plugins: [],
}
