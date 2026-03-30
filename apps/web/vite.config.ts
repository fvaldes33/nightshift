import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ isSsrBuild }) => ({
  envDir: "../../",
  build: {
    rollupOptions: isSsrBuild ? { input: "./server/app.ts" } : undefined,
  },
  ssr: {
    noExternal: [/@uiw*/, /@codemirror*/],
  },
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    allowedHosts: true,
    // HMR works on localhost; over Tailscale the WS port isn't proxied
    // so the browser gracefully falls back to full reloads.
  },
}));
