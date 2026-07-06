/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        crimson: {
          DEFAULT: '#7B1C2A',
          50: '#FDF2F4',
          100: '#FAE0E4',
          200: '#F5C1C9',
          300: '#EC97A4',
          400: '#E06175',
          500: '#CC3350',
          600: '#AC2040',
          700: '#7B1C2A',
          800: '#5C1520',
          900: '#3E0E16',
          950: '#220009',
        },
        maroon: {
          sidebar: '#6B0F1A',
          dark: '#4A0A12',
          light: '#8B1E2D',
          active: '#7B1C2A',
        },
        page: {
          bg: '#F5F0EE',
          card: '#FFFFFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
