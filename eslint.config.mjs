import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
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
  {
    files: ["**/*.tsx"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
    },
  },
  {
    files: ["**/*.{js,mjs}"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["packages/pixelforge/src/**/*.js"],
    languageOptions: {
      globals: {
        PF: "readonly",
      },
    },
    rules: {
      "no-control-regex": "off",
    },
  },
  {
    // Beholder's client modules are concatenated into one IIFE by
    // scripts/build-beholder-package.mjs, so they share a scope that per-file
    // linting cannot see. BH_STYLE_CSS, BH_FA_CSS, BH_LOCALES and BH_LOGO are
    // emitted by that builder; the rest are defined in a sibling module.
    files: ["packages/beholder/src/**/*.js"],
    languageOptions: {
      globals: {
        BH: "readonly",
        BH_FA_CSS: "readonly",
        BH_HOST_CSS: "readonly",
        BH_LOCALES: "readonly",
        BH_LOGO: "readonly",
        BH_STYLE_CSS: "readonly",
        GARMENT_CANON: "readonly",
        canonicalGarment: "readonly",
        normalizeColor: "readonly",
        renderDollPanel: "readonly",
        setDollLayout: "readonly",
        withDependentMissing: "readonly",
      },
    },
  },
  {
    files: ["scripts/validate-pr-triage.mjs"],
    rules: {
      "no-regex-spaces": "off",
    },
  },
);
