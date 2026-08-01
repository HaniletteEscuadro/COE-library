import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    /*
     * Third-party bundles we ship but do not author.
     *
     * These are minified releases of pdf.js and socket.io-client. Linting them
     * produced 2,508 of the project's 2,517 reported problems — all of it noise
     * from a minifier's comma expressions and single-letter names, none of it
     * actionable, and enough to bury the handful of real findings in our own
     * code. Upgrading these files means replacing them, not editing them.
     */
    "public/vendor/**",

    /*
     * Generated copy of the student portal, written by
     * `scripts/bundle-portal.mjs` at build time. The originals live one folder
     * up and are not part of this TypeScript project.
     */
    "portal/**",
  ]),

  {
    rules: {
      /*
       * `_name` means "deliberately unused".
       *
       * Two patterns in this codebase need it and neither is a mistake:
       * stripping a field by destructuring it out (`const { answerKey:
       * _answerKey, ...safe } = row` — how `submissions.ts` keeps an answer key
       * from ever reaching a student), and keeping a parameter that a function's
       * callers still pass. Without this, both are reported as dead code and the
       * only way to silence them is a disable comment on every occurrence.
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
