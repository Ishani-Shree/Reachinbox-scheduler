/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        logo: ['Silkscreen', 'monospace'],
      },
      colors: {
        // Greens from the Figma: solid Login button, outline buttons, chips and active nav.
        brand: {
          50: '#e9f6ee',
          100: '#d4eedd',
          200: '#a7dbb8',
          500: '#00a63e',
          600: '#008f35',
          700: '#0b7a33',
        },
        ink: {
          900: '#1a1a1a',
          700: '#3d3d3d',
          500: '#6b6b6b',
          400: '#9a9a9a',
          300: '#c2c2c2',
          200: '#e6e6e6',
          100: '#efefef',
          50: '#f5f6f5',
        },
        // Scheduled time pill
        pending: {
          50: '#fff1e5',
          200: '#fbc9a0',
          700: '#c2410c',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04)',
        pop: '0 8px 28px rgba(16, 24, 40, 0.14)',
      },
    },
  },
  plugins: [],
};
