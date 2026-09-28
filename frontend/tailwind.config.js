/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#ecfbf2',
          100: '#d2f5e0',
          200: '#a6eac2',
          500: '#23b35f',
          600: '#1c9950',
          700: '#177a41',
        },
        ink: {
          900: '#1a1a1a',
          700: '#3d3d3d',
          500: '#6b6b6b',
          400: '#9a9a9a',
          200: '#e4e4e4',
          100: '#f1f1f1',
          50: '#f7f7f7',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.08)',
        pop: '0 12px 32px rgba(16, 24, 40, 0.14)',
      },
    },
  },
  plugins: [],
};
