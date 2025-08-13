import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
    "./src/renderer/pages/**/*.{js,ts,jsx,tsx}",
    "./src/renderer/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      fontFamily: {
        'game': ['Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        'game-bg': '#000000',
        'game-text': '#ffffff',
        'game-accent': '#00ff00',
        'game-danger': '#ff0000',
        'game-warning': '#ffff00',
        'mg-brand': {
          50:  '#fce9e4',
          100: '#f8c4b3',
          200: '#f29d85',
          300: '#eb7557',
          400: '#e54f2e',
          500: '#d3593a', // 基本色
          600: '#b94e33',
          700: '#9f432c',
          800: '#853826',
          900: '#6b2e20',
        },
      }
    },
  },
  plugins: [],
};
export default config;
