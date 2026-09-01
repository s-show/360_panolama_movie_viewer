// ESLint フラット設定（eslint >= 9、既定の eslint.config.* 形式）。
// 旧 .eslintrc.json の env: { browser, node, es2021 } + extends: eslint:recommended
// + rules { semi, quotes } を等価に移行している。
// @ts-check
import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      semi: ["error", "always"],
      quotes: ["error", "double"],
    },
  },
];
