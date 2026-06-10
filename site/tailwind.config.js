/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dw: {
          bg: 'var(--dw-bg)',
          surface: 'var(--dw-surface)',
          gold: '#D4A853',
          accent: '#6366F1',
          text: 'var(--dw-text)',
          textMuted: 'var(--dw-text-muted)',
          border: 'var(--dw-border)',
        },
      },
    },
  },
  plugins: [],
};
