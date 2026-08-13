/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sf: {
          primary: 'var(--sf-primary)',
          'primary-hover': 'var(--sf-primary-hover)',
          'primary-light': 'var(--sf-primary-light)',
          bg: 'var(--sf-bg)',
          panel: 'var(--sf-panel)',
          input: 'var(--sf-input)',
          border: 'var(--sf-border)',
          text: 'var(--sf-text)',
          muted: 'var(--sf-muted)',
          accent: 'var(--sf-accent)',
          sidebar: 'var(--sf-sidebar)',
          danger: '#dc2626',
          success: '#16a34a',
          warn: '#d97706',
        },
      },
      borderRadius: {
        sf: 'var(--sf-radius-md)',
        'sf-lg': 'var(--sf-radius-lg)',
        'sf-sm': 'var(--sf-radius-sm)',
      },
      fontFamily: {
        heading: ['Roboto Slab', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
