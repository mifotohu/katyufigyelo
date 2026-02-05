/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        danger: '#dc2626',
        warning: '#facc15',
        safe: '#2563eb',
      }
    },
  },
  plugins: [],
}