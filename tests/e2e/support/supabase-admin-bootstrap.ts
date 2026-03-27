import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

interface TestBootstrapEnv {
  supabaseUrl: string;
  serviceRoleKey: string;
}

function readEnvFile() {
  const envFilePath = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(envFilePath)) {
    throw new Error("No encontramos .env.local para bootstrap de usuarios E2E.");
  }

  return fs.readFileSync(envFilePath, "utf8");
}

function readEnvValue(source: string, name: string) {
  const envLine = source
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith(`${name}=`));

  if (!envLine) {
    return undefined;
  }

  return envLine.slice(envLine.indexOf("=") + 1).trim();
}

function readRequiredBootstrapEnv(): TestBootstrapEnv {
  const envSource = readEnvFile();
  const supabaseUrl = readEnvValue(envSource, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readEnvValue(envSource, "SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL es obligatorio en .env.local para el bootstrap E2E.");
  }

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY es obligatoria en .env.local para crear usuarios E2E confirmados.");
  }

  return {
    supabaseUrl,
    serviceRoleKey,
  };
}

let cachedBootstrapEnv: TestBootstrapEnv | null = null;

function getSupabaseAdminClient() {
  cachedBootstrapEnv ??= readRequiredBootstrapEnv();

  return createClient(cachedBootstrapEnv.supabaseUrl, cachedBootstrapEnv.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function createConfirmedE2eUser(credentials: {
  email: string;
  password: string;
}) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { error } = await supabaseAdmin.auth.admin.createUser({
    email: credentials.email,
    password: credentials.password,
    email_confirm: true,
  });

  if (error && !/already registered|already been registered/i.test(error.message)) {
    throw new Error(
      `No fue posible crear el usuario E2E ${credentials.email}: ${error.message}`,
    );
  }
}
