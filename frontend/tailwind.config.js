/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        ink: '#172033',
        mist: '#eef4ff'
      },
      boxShadow: {
        soft: '0 16px 40px rgba(23, 32, 51, 0.08)'
      }
    }
  },
  plugins: []
};
