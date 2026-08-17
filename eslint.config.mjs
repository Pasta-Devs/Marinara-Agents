import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const maintainedSourceFiles = [
  "packages/**/src/**/*.{js,mjs,ts,tsx}",
  "scripts/**/*.{js,mjs}",
  "tests/**/*.{js,mjs,ts,tsx}",
  "eslint.config.mjs",
];

export default tseslint.config(
  {
    ignores: [
      "artifacts/**",
      "catalog/**",
      "node_modules/**",
      "packages/*/client.js",
      "packages/*/server.mjs",
      "sources/engine/**",
    ],
  },
  {
    files: maintainedSourceFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.{js,mjs}"],
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
