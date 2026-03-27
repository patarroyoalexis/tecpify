import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: [
      "app/**/*.{js,jsx,ts,tsx}",
      "data/**/*.{js,jsx,ts,tsx}",
      "lib/auth/**/*.{js,jsx,ts,tsx}",
      "lib/data/**/*.{js,jsx,ts,tsx}",
      "middleware.ts",
      "lib/supabase/server.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/service-role",
              message:
                "El flujo normal del MVP no puede depender de guardrails privilegiados ni de service role.",
            },
            {
              name: "@/lib/supabase/internal/service-role-client",
              message:
                "El cliente privilegiado es internal-only y no puede importarse desde modulos operativos.",
            },
          ],
          patterns: [
            {
              group: [
                "**/supabase/service-role",
                "**/supabase/service-role.*",
                "**/supabase/internal/service-role-client",
                "**/supabase/internal/service-role-client.*",
              ],
              message:
                "Los modulos operativos del MVP no pueden alcanzar helpers de service role por imports relativos ni reexports.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
