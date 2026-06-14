/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'log-debug': '#6b7280',
        'log-info': '#3b82f6',
        'log-warn': '#f59e0b',
        'log-error': '#ef4444',
        'log-fatal': '#7c2d12',
      },
      fontFamily: {
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
