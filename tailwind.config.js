/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#c9a96e', dim: '#a08550', bright: '#e0c48a' },
        surface: { 1: '#0d1117', 2: '#161b22', 3: '#1c2333', hover: '#21262d' },
        border: { DEFAULT: '#30363d', light: '#444c56' },
        up: '#f85149',    // 涨 = 红 (中国市场)
        down: '#3fb950',  // 跌 = 绿
        // Named colors to eliminate arbitrary value warnings
        sidebar: '#111119',
        deep: '#0a0a12',
        header: '#15151f',
        card: '#0d0d14',
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"SF Mono"', '"Cascadia Code"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
