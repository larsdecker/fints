import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
      "*.config.js",
      "generated/**",
      "xmlns/**",
      "packages/*/generated/**",
      "packages/*/dist/**",
      "packages/*/coverage/**"
    ]
  },
  {
    files: ["generated/**"],
    rules: {
      "no-redeclare": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-undef": "off"
    }
  },
  {
    files: ["**/*.d.ts"],
    rules: {
      "no-redeclare": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-undef": "off",
      "prettier/prettier": "off"
    }
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module"
      },
      globals: {
        // Jest globals
        describe: "readonly",
        test: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        jest: "readonly",
        // Node.js globals
        Buffer: "readonly",
        process: "readonly",
        global: "readonly",
        console: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Response: "readonly",
        fetch: "readonly",
        AbortController: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      prettier: prettierPlugin
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...prettier.rules,
      "prettier/prettier": "error",
      "no-empty-pattern": "off",
      "no-case-declarations": "off",
      "no-useless-escape": "warn",
      "getter-return": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "no-undef": [
        "error",
        {
          typeof: true
        }
      ]
    }
  }
];
