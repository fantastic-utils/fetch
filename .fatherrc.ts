import { defineConfig } from "father";

export default defineConfig({
  esm: { input: "src" },
  cjs: { input: "src" },
  umd: {
    name: "fuFetch",
    entry: "src/index",
    output: "dist/umd"
  },
});
