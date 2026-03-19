import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        warm: {
          bg: "#1a1412",
          surface: "#2a1f1a",
          accent: "#F4A261",
          coral: "#E76F51",
          purple: "#9B5DE5",
          cream: "#FFF8F0",
        },
      },
    },
  },
  plugins: [],
};
export default config;
