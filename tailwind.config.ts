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
        muted: "#5A6B80",
        ok: "#176B45",
        okbg: "#E7F6EE",
        bad: "#9C3E2F",
        badbg: "#FAEAE7",
        pend: "#8A5A14",
        pendbg: "#FBF1E1",
        rev: "#1B5A82",
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
