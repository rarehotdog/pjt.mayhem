import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#14111f",
        cream: "#fff8ee",
        peach: "#ffcc8d",
        coral: "#ff7159",
        mint: "#68d7b8",
        sky: "#7ac7f8"
      },
      boxShadow: {
        card: "0 10px 30px rgba(20, 17, 31, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
