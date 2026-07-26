import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "./src/index.ts",
      formats: ["es"],
      fileName: () => "server.mjs",
    },
    rollupOptions: {
      external: ["googleapis", "@modelcontextprotocol/sdk", "zod", /^node:/],
    },
    target: "node20",
    minify: false,
    emptyOutDir: true,
  },
});
