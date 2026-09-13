import { defineConfig } from "vite";

export default defineConfig({
  base: "/menagerie/",
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
