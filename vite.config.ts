import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, transformWithEsbuild, type Plugin } from "vite";
import dts from "vite-plugin-dts";

const outputDirectory = resolve(__dirname, "dist");

/** Vite 会为 ESM 库保留空白，此插件在生成阶段执行最后一次完整压缩。 */
const minifyEsmWhitespace = (): Plugin => ({
  name: "minify-esm-whitespace",
  enforce: "post",
  async generateBundle(outputOptions, bundle) {
    if (outputOptions.format !== "es") return;
    for (const output of Object.values(bundle)) {
      if (output.type !== "chunk") continue;
      const result = await transformWithEsbuild(output.code, output.fileName, {
        target: "es2022",
        format: "esm",
        minify: true,
        legalComments: "none",
      });
      output.code = result.code;
    }
  },
});

export default defineConfig({
  plugins: [
    dts({
      // 保留公开 API 的中文 JSDoc，确保编辑器能展示字段和类型说明。
      afterBuild: async () => {
        await copyFile(
          resolve(outputDirectory, "index.d.ts"),
          resolve(outputDirectory, "index.d.cts"),
        );
      },
    }),
    minifyEsmWhitespace(),
  ],
  build: {
    // Node.js 18 与现代浏览器均支持 ES2022，可避免注入异步函数和类字段辅助代码。
    target: "es2022",
    // Vite 的库模式默认保留可读格式，这里显式压缩发布产物。
    minify: "esbuild",
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es", "cjs"],
      fileName: format => format === "es" ? "index.js" : "index.cjs",
    },
  },
});
