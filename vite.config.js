import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, "src/lib"),
      $components: path.resolve(__dirname, "src/lib/components"),
      $styles: path.resolve(__dirname, "src/styles"),
    },
  },
  plugins: [
    svelte(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "autoUpdate",
      injectRegister: false,
      manifest: false,
      includeAssets: ["favicon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"],
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,webmanifest,png,svg,webp,woff2}"],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
