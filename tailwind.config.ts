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
      }
    },
  },
  plugins: [],
};
export default config;
