import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1C30",
        steel: "#272E42",
        accent: "#2E86C1",
        accentbg: "#E8F4FC",
        paper: "#F3F6F9",
        line: "#DCE3EA",
        muted: "#64748A",
        ok: "#3F9A68",
        okbg: "#E7F6EE",
        bad: "#B5473A",
        badbg: "#FAEAE7",
        pend: "#C98A2D",
        pendbg: "#FBF1E1",
        rev: "#2E86C1",
        revbg: "#E8F4FC",
      },
      fontFamily: {
        serif: ['"Source Serif 4"', "Georgia", "serif"],
        sans: ['"IBM Plex Sans"', "Inter", "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
