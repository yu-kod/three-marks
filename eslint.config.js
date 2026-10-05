import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["**/dist/", "**/coverage/", "**/node_modules/", "infra/"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // React を使うワークスペースだけに React のルールを掛ける
    files: ["apps/web/**/*.{ts,tsx}", "packages/web-core/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // ゲームエンジンは I/O を持たない純粋関数。乱数は Rng を引数で注入する（CLAUDE.md）
    files: ["apps/engine/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "ゲームエンジンで Math.random() は使わない。Rng を引数で注入すること。",
        },
      ],
    },
  },
  {
    // shadcn/ui の生成物は variants を同じファイルから export する
    files: ["apps/web/src/components/ui/**"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  }
);
