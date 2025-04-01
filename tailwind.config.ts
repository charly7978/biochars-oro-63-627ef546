
import type { Config } from "tailwindcss";
import { theme, utilities } from "./src/theme";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme,
  plugins: [
    require("tailwindcss-animate"),
    utilities
  ],
} satisfies Config;
