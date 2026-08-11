import { defineConfig } from "vite";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    lib: {
      entry: "./src/index.ts",
      formats: ["es"],
      fileName: () => "server.mjs",
    },
    rollupOptions: {
      external: [
        "googleapis",
        /^@modelcontextprotocol\//,
        "zod",
        /^node:/,
        "better-sqlite3",
        "drizzle-orm",
        /^drizzle-orm\//,
        "hono",
        /^hono\//,
        "@hono/node-server",
      ],
    },
    target: "node20",
    minify: false,
    emptyOutDir: true,
  },
});
