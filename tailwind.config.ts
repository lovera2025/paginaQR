import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        noche: "#050508",
        tinta: "#140f02",
        oro: {
          DEFAULT: "#d4a853",
          claro: "#f0d389",
          oscuro: "#b8862e",
        },
        naranja: "#e0953c",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Montserrat", "system-ui", "sans-serif"],
        script: ["var(--font-script)", "cursive"],
      },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        "fade-up": { from: { opacity: "0", transform: "translateY(24px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        twinkle: { "0%,100%": { opacity: "0.3" }, "50%": { opacity: "0.85" } },
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        shine: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(212,168,83,0.45)" },
          "100%": { boxShadow: "0 0 0 18px rgba(212,168,83,0)" },
        },
      },
      animation: {
        marquee: "marquee 30s linear infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.22,1,0.36,1) both",
        twinkle: "twinkle 4s ease-in-out infinite",
        floaty: "floaty 3s ease-in-out infinite",
        shine: "shine 6s linear infinite",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
