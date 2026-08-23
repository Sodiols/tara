import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      maxWidth: {
        container: "1440px",
      },
      borderRadius: {
        control: "6px",
        panel: "10px",
      },
      transitionDuration: {
        DEFAULT: "250ms",
      },
      colors: {
        // Official TARA brand palette (RGB channels defined in globals.css :root,
        // referenced here with the <alpha-value> pattern so bg-taraWine/50 etc. work).
        taraWine: "rgb(var(--tara-wine-rgb) / <alpha-value>)",
        taraIvory: "rgb(var(--tara-ivory-rgb) / <alpha-value>)",
        taraWhite: "rgb(var(--tara-white-rgb) / <alpha-value>)",
        taraBlack: "rgb(var(--tara-black-rgb) / <alpha-value>)",
        taraRose: "rgb(var(--tara-rose-rgb) / <alpha-value>)",
        taraTaupe: "rgb(var(--tara-taupe-rgb) / <alpha-value>)",

        // Existing semantic aliases used throughout components, mapped onto the
        // official palette so every existing class resolves to an approved colour.
        cream: "rgb(var(--tara-ivory-rgb) / <alpha-value>)",
        beige: "rgb(var(--tara-ivory-rgb) / <alpha-value>)",
        ink: "rgb(var(--tara-black-rgb) / <alpha-value>)",
        wine: "rgb(var(--tara-wine-rgb) / <alpha-value>)",
        // "Muted TARA Black" — Black at a fixed reduced opacity, used for secondary
        // text per the brand guide (never Warm Taupe or Rose for body copy).
        muted: "rgb(var(--tara-black-rgb) / 0.62)",
        // "Warm Taupe, reduced opacity" — used for all subtle borders/dividers.
        border: "rgb(var(--tara-taupe-rgb) / 0.35)",
      },
      fontFamily: {
        // Bodoni Moda — display/editorial headings only.
        serif: ["var(--font-heading)", "serif"],
        display: ["var(--font-heading)", "serif"],
        // Manrope — body copy and all interface/functional text.
        sans: ["var(--font-body)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.25em",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        slideUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.4s ease forwards",
        slideInRight: "slideInRight 0.35s ease forwards",
        slideInLeft: "slideInLeft 0.35s ease forwards",
        slideUp: "slideUp 0.4s ease forwards",
      },
    },
  },
  plugins: [],
};

export default config;
