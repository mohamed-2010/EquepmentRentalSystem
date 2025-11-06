import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Ensure Electron always connects to the expected port.
    // If 8080 is taken, Vite will FAIL instead of switching to another port.
    // This prevents `wait-on http://localhost:8080` from hanging forever.
    strictPort: true,
    proxy:
      mode === "development"
        ? undefined
        : {
            "/": {
              target: "http://localhost:8080",
              changeOrigin: true,
            },
          },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(
    Boolean
  ),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  base: "./", // Important for Electron
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
}));
