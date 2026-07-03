import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * ESLint 9 flat config for Next.js 16.
 * Replaces the legacy .eslintrc.json — `next lint` is deprecated in Next 16,
 * so the `lint` script runs `eslint .` directly against this config.
 * eslint-config-next@16 ships flat-config arrays, so we spread them directly
 * (core-web-vitals + typescript = the old `extends` pair).
 */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "bridge/**",
      "bridge-edit/**",
      "review-bridge/**",
      "flow-bridge/**",
      "storage/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    // TODO(v1.1): refactor the ~25 pre-existing set-state-in-effect /
    // ref-in-render patterns flagged by the React 19 hooks rules
    // (eslint-config-next@16), then restore these to "error".
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
];

export default eslintConfig;
