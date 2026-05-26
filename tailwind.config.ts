import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#d4af37",
          dark: "#b8941f",
        },
        gold: {
          50: "#fdf6e3",
          100: "#faecbf",
          200: "#f5d97c",
          300: "#efc449",
          400: "#e0b428",
          500: "#d4af37",
          600: "#b8941f",
          700: "#967714",
          800: "#6f580f",
          900: "#4a3a0a",
        },
        ink: {
          DEFAULT: "#0a0a0a",
          soft: "#171717",
          softer: "#262626",
          border: "#3f3f46",
        },
        blue: {
          50: "#fdf6e3",
          100: "#faecbf",
          200: "#f5d97c",
          300: "#efc449",
          400: "#e0b428",
          500: "#d4af37",
          600: "#b8941f",
          700: "#967714",
          800: "#6f580f",
          900: "#4a3a0a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
