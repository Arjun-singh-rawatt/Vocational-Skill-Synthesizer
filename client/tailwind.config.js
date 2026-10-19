/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff3ff',
          100: '#dce5ff',
          200: '#bfd0ff',
          300: '#91adff',
          400: '#6488f3',
          500: '#3f65e8',
          600: '#284BD6',
          700: '#203fb6',
          800: '#1d3692',
          900: '#1a2e70',
        },
        tealbrand: {
          50: '#f0fdfa',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        }
      }
    },
  },
  plugins: [],
}
