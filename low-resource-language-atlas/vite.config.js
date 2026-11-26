import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://lindazeng979.github.io/low-resource-language-atlas/ on GitHub Pages.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/low-resource-language-atlas/" : "/",
}));
