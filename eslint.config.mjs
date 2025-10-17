import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // React specific rules
      "react/no-unescaped-entities": "off",
      "react/display-name": "warn",
      "react-hooks/exhaustive-deps": "warn",
      
      // TypeScript specific rules
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      
      // General rules
      "no-console": ["warn", { "allow": ["warn", "error"] }],
      "no-debugger": "error",
      "prefer-const": "error",
      "no-var": "error",
      "object-shorthand": "warn",
      "prefer-template": "warn",
      
      // Import rules
      "import/order": [
        "warn",
        {
          "groups": [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index"
          ],
          "newlines-between": "always",
          "alphabetize": {
            "order": "asc",
            "caseInsensitive": true
          }
        }
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "*.config.js",
      "*.config.mjs",
      "public/libs/**",
      "test_layer_mapping.js",
      "test_units_inference.js",
      "test_cad_parser.js",
      "test_geometry_normalization.js",
      "test_assumptions_sheet.js",
      "src/app/agent/**",
      "src/app/api/**",
      "src/app/properties/**",
      "src/app/test/**",
      "src/components/agent/**",
      "src/services/**",
      "src/utils/asyncProcessor.ts",
      "scripts/**",
    ],
  },
];

export default eslintConfig;
