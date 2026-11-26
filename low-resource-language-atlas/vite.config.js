import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://lindazeng979.github.io/low-resource-language-atlas/ on GitHub Pages.
// `vite preview` uses the same base so it previews exactly what Pages serves.
export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  base: command === "build" || isPreview ? "/low-resource-language-atlas/" : "/",
}));
