import { loadEnvConfig } from "@next/env";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

import {
  getOperationalEnv,
  getPlaywrightAuthFixtures,
  type PlaywrightAuthFixtureUser,
} from "../../lib/env";
import { createInternalServiceRoleSupabaseClient } from "../../lib/supabase/internal/service-role-client";

const PLAYWRIGHT_AUTH_FIXTURE_BOOTSTRAP_USAGE_ID = "playwright_auth_fixture_bootstrap";
const AUTH_ADMIN_PAGE_SIZE = 200;

function createNonPrivilegedAuthClient() {
  const operationalEnv = getOperationalEnv();

  return createClient(
    operationalEnv.nextPublicSupabaseUrl,
    operationalEnv.nextPublicSupabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

function buildFixtureUserMetadata(namespace: string, fixtureUser: PlaywrightAuthFixtureUser) {
  return {
    e2eFixture: "playwright_auth",
    fixtureNamespace: namespace,
    fixtureRole: fixtureUser.role,
  };
}

async function findAuthUserByEmail(email: string) {
  const privilegedClient = createInternalServiceRoleSupabaseClient(
    PLAYWRIGHT_AUTH_FIXTURE_BOOTSTRAP_USAGE_ID,
  );
  let page = 1;

  while (true) {
    const { data, error } = await privilegedClient.auth.admin.listUsers({
      page,
      perPage: AUTH_ADMIN_PAGE_SIZE,
    });

    if (error) {
      throw new Error(
        `No fue posible listar usuarios de Auth para preparar las fixtures E2E. ${error.message}`,
      );
    }

    const matchedUser = data.users.find((user) => user.email === email);

    if (matchedUser) {
      return matchedUser;
    }

    if (!data.nextPage || data.nextPage <= page) {
      return null;
    }

    page = data.nextPage;
  }
}

async function createFixtureUser(namespace: string, fixtureUser: PlaywrightAuthFixtureUser) {
  const privilegedClient = createInternalServiceRoleSupabaseClient(
    PLAYWRIGHT_AUTH_FIXTURE_BOOTSTRAP_USAGE_ID,
  );
  const { data, error } = await privilegedClient.auth.admin.createUser({
    email: fixtureUser.email,
    password: fixtureUser.password,
    email_confirm: true,
    ban_duration: "none",
    user_metadata: buildFixtureUserMetadata(namespace, fixtureUser),
  });

  if (error || !data.user) {
    throw new Error(
      `No fue posible crear la fixture Auth ${fixtureUser.role} para Playwright. ${error?.message ?? "Sin usuario devuelto por Supabase Auth."}`,
    );
  }

  return data.user;
}

async function updateFixtureUser(
  existingUser: User,
  namespace: string,
  fixtureUser: PlaywrightAuthFixtureUser,
) {
  const privilegedClient = createInternalServiceRoleSupabaseClient(
    PLAYWRIGHT_AUTH_FIXTURE_BOOTSTRAP_USAGE_ID,
  );
  const { data, error } = await privilegedClient.auth.admin.updateUserById(existingUser.id, {
    password: fixtureUser.password,
    email_confirm: true,
    ban_duration: "none",
    user_metadata: {
      ...(existingUser.user_metadata ?? {}),
      ...buildFixtureUserMetadata(namespace, fixtureUser),
    },
  });

  if (error || !data.user) {
    throw new Error(
      `No fue posible actualizar la fixture Auth ${fixtureUser.role} para Playwright. ${error?.message ?? "Sin usuario devuelto por Supabase Auth."}`,
    );
  }

  return data.user;
}

async function upsertFixtureUser(namespace: string, fixtureUser: PlaywrightAuthFixtureUser) {
  const existingUser = await findAuthUserByEmail(fixtureUser.email);

  if (!existingUser) {
    return createFixtureUser(namespace, fixtureUser);
  }

  return updateFixtureUser(existingUser, namespace, fixtureUser);
}

async function assertFixtureCanLogin(fixtureUser: PlaywrightAuthFixtureUser) {
  const authClient = createNonPrivilegedAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({
    email: fixtureUser.email,
    password: fixtureUser.password,
  });

  if (error || !data.user) {
    throw new Error(
      [
        `La fixture ${fixtureUser.role} no pudo autenticarse con password despues del bootstrap E2E.`,
        error?.message ?? "Supabase Auth no devolvio un usuario autenticado.",
      ].join(" "),
    );
  }
}

async function bootstrapPlaywrightAuthFixtures() {
  const fixtures = getPlaywrightAuthFixtures();

  for (const fixtureUser of [fixtures.owner, fixtures.intruder]) {
    await upsertFixtureUser(fixtures.namespace, fixtureUser);
    await assertFixtureCanLogin(fixtureUser);
  }
}

export default async function globalSetup() {
  loadEnvConfig(process.cwd());

  try {
    await bootstrapPlaywrightAuthFixtures();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Fallo desconocido preparando fixtures E2E.";

    throw new Error(
      [
        "No fue posible preparar las fixtures E2E de Auth antes de ejecutar Playwright.",
        "Configura la service role aislada de test, PLAYWRIGHT_E2E_PASSWORD y, si quieres aislar namespaces compartidos, PLAYWRIGHT_E2E_NAMESPACE.",
        message,
      ].join(" "),
    );
  }
}
