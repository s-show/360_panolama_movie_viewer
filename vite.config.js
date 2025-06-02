import { defineConfig } from "vite";
//インストールした「vite-plugin-singlefile」をインポート
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  //pluginsに記述することでJSとCSSがインライン化された単一htmlを出力するように
  plugins: [
    viteSingleFile(),
  ],
  build: {
    minify: false,
  }
});
