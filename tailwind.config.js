/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.ts', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: { colors: {
    canvas: '#191A1C', panel: '#24272B', line: '#34383D', ink: '#F4F1EA', muted: '#969CA4', accent: '#FF8735'
  } } },
  plugins: [],
};
