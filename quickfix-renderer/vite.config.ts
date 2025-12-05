import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "ts/index.ts",
      name: "QuickfixRenderer",
      formats: ["es"],
      fileName: "quickfix-renderer"
    },
    target: "esnext",
    sourcemap: true,
    rollupOptions: {
      external: [],
      output: {
        interop: "auto"
      }
    }
  }
});
