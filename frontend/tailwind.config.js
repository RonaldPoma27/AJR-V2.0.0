/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Tokens semánticos: sus valores viven en index.css (:root = claro, .dark = oscuro).
      // Usar estos nombres en vez de gray-*/white hace que el modo oscuro funcione solo.
      colors: {
        app: token("app"), // fondo de la página
        surface: { DEFAULT: token("surface"), 2: token("surface-2") }, // tarjetas / paneles
        line: token("line"), // bordes y divisores
        fg: { DEFAULT: token("fg"), muted: token("fg-muted"), subtle: token("fg-subtle") },
        accent: token("accent"), // texto/links de marca (cambia de tono en oscuro para contrastar)
        ink: "#0a0f1a", // barra superior: siempre oscura, combina con el fondo del logo
        brand: {
          DEFAULT: "#1d6ae5", // fondo de botones (blanco encima = contraste 4.95:1)
          dark: "#1a5fd0",
        },
      },
      borderColor: { DEFAULT: token("line") },
      divideColor: { DEFAULT: token("line") },
    },
  },
  plugins: [],
};
