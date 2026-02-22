import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "Menlo", "monospace"],
      },
      colors: {
        base: "#0a0a0b",
        surface: {
          DEFAULT: "#141416",
          hover: "#1a1a1e",
          border: "#1f1f23",
          elevated: "#1e1e22",
        },
        accent: {
          DEFAULT: "#e2945a",
          hover: "#d4803f",
          muted: "rgba(226, 148, 90, 0.15)",
          subtle: "rgba(226, 148, 90, 0.06)",
        },
        warm: {
          DEFAULT: "#e8e5e0",
          muted: "#9a9590",
          faint: "#5a5652",
        },
        success: "#6ec97a",
        danger: "#e55c5c",
      },
      keyframes: {
        grain: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-5%, -10%)" },
          "30%": { transform: "translate(3%, -15%)" },
          "50%": { transform: "translate(12%, 9%)" },
          "70%": { transform: "translate(9%, 4%)" },
          "90%": { transform: "translate(-1%, 7%)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        grain: "grain 8s steps(10) infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
