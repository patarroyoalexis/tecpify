/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { NextRequest } = require("next/server");

const { loadTsModule } = require("./helpers/test-runtime.cjs");

const repoRoot = process.cwd();
const SOURCE_PATHS_TO_AUDIT = [
  "AGENTS.md",
  "README.md",
  "app",
  "components",
  "data",
  "eslint.config.mjs",
  "lib",
  "next.config.ts",
  "package.json",
  "playwright.config.ts",
  "proxy.ts",
];
const IGNORED_DIRECTORIES = new Set([".git", ".next", ".tmp", "node_modules", "test-results"]);
const DEPRECATED_MIDDLEWARE_PATTERN = /\bmiddleware\b/i;

function normalizeRelativePath(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function collectFiles(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const stat = fs.statSync(absolutePath);

  if (stat.isFile()) {
    return [normalizeRelativePath(relativePath)];
  }

  const entries = fs.readdirSync(absolutePath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    files.push(...collectFiles(path.join(relativePath, entry.name)));
  }

  return files;
}

function getAuditedSourceFiles() {
  return SOURCE_PATHS_TO_AUDIT.flatMap((relativePath) => collectFiles(relativePath)).sort();
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("next proxy migration: no quedan archivos activos con la convencion middleware", () => {
  const legacyFiles = getAuditedSourceFiles().filter((relativePath) =>
    /^middleware\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts)$/i.test(path.basename(relativePath)),
  );
  const deprecatedReferences = getAuditedSourceFiles().filter((relativePath) => {
    const source = readRepoFile(relativePath);
    DEPRECATED_MIDDLEWARE_PATTERN.lastIndex = 0;
    return DEPRECATED_MIDDLEWARE_PATTERN.test(source);
  });

  assert.deepEqual(
    legacyFiles,
    [],
    `No debe quedar ningun archivo runtime/documental usando la convencion middleware: ${legacyFiles.join(", ")}`,
  );
  assert.deepEqual(
    deprecatedReferences,
    [],
    `No debe quedar ninguna referencia activa a middleware en runtime/documentacion/config: ${deprecatedReferences.join(", ")}`,
  );
});

test("next proxy migration: el root proxy exporta el matcher canonico y acotado", () => {
  const { config } = loadTsModule("proxy.ts");
  const { PRIVATE_ROUTE_PROXY_CONFIG, PRIVATE_ROUTE_PROXY_MATCHER } = loadTsModule(
    "lib/auth/proxy.ts",
  );

  assert.deepEqual(PRIVATE_ROUTE_PROXY_MATCHER, [
    "/admin/:path*",
    "/dashboard/:path*",
    "/pedidos/:path*",
    "/metricas/:path*",
  ]);
  assert.deepEqual(config, PRIVATE_ROUTE_PROXY_CONFIG);
  assert.deepEqual(config, {
    matcher: ["/admin/:path*", "/dashboard/:path*", "/pedidos/:path*", "/metricas/:path*"],
  });
});

test("next proxy migration: las rutas privadas sin sesion redirigen a login preservando redirectTo", async () => {
  const { enforcePrivateRouteProxyAuth } = loadTsModule("lib/auth/proxy.ts");
  const request = new NextRequest(
    "https://tecpify.test/pedidos/mi-negocio?estado=pendiente&vista=lista",
  );

  const response = await enforcePrivateRouteProxyAuth(request, {
    createSupabaseClient: () => ({
      auth: {
        async getUser() {
          return {
            data: { user: null },
            error: null,
          };
        },
      },
    }),
  });

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://tecpify.test/login?redirectTo=%2Fpedidos%2Fmi-negocio%3Festado%3Dpendiente%26vista%3Dlista",
  );
});

test("next proxy migration: /admin sin sesion redirige a login con redirectTo intacto", async () => {
  const { enforcePrivateRouteProxyAuth } = loadTsModule("lib/auth/proxy.ts");
  const request = new NextRequest("https://tecpify.test/admin?panel=platform");

  const response = await enforcePrivateRouteProxyAuth(request, {
    createSupabaseClient: () => ({
      auth: {
        async getUser() {
          return {
            data: { user: null },
            error: null,
          };
        },
      },
    }),
  });

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://tecpify.test/login?redirectTo=%2Fadmin%3Fpanel%3Dplatform",
  );
});

test("next proxy migration: una sesion autenticada sigue pasando y puede propagar refresh de cookies", async () => {
  const { enforcePrivateRouteProxyAuth } = loadTsModule("lib/auth/proxy.ts");
  const request = new NextRequest("https://tecpify.test/dashboard");

  const response = await enforcePrivateRouteProxyAuth(request, {
    createSupabaseClient: (_request, draftResponse) => {
      draftResponse.cookies.set("sb-tecpify-auth", "refreshed-session", {
        httpOnly: true,
        path: "/",
      });

      return {
        auth: {
          async getUser() {
            return {
              data: { user: { id: "owner-1" } },
              error: null,
            };
          },
        },
      };
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.cookies.get("sb-tecpify-auth")?.value, "refreshed-session");
});
