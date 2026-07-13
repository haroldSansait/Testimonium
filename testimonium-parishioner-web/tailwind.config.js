/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        crimson: {
          DEFAULT: 'var(--color-crimson)',
          dark: 'var(--color-crimson-dark)',
          light: 'var(--color-crimson-light)',
        },
        sidebar: {
          bg: 'var(--color-sidebar-bg)',
          dark: 'var(--color-sidebar-dark)',
        },
        app: {
          base: 'var(--bg-app-base)',
          page: 'var(--color-page-bg)',
          card: 'var(--color-card-bg)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          muted: 'var(--color-text-muted)',
        },
        status: {
          pending: 'var(--status-pending)',
          underReview: 'var(--status-under-review)',
          ready: 'var(--status-ready)',
          rejected: 'var(--status-rejected)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['"Playfair Display"', 'serif'],
      },
      borderRadius: {
        card: 'var(--radius-card)',
        button: 'var(--radius-button)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
      transitionDuration: {
        fast: 'var(--transition-fast)',
      }
    },
  },
  plugins: [],
}
