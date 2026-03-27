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

async function findUserIdByEmail(email: string) {
  const supabaseAdmin = getSupabaseAdminClient();
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw new Error(
        `No fue posible listar usuarios E2E para ${email}: ${error.message}`,
      );
    }

    const matchedUser = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );

    if (matchedUser) {
      return matchedUser.id;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }
}

export async function ensureConfirmedE2eUser(credentials: {
  email: string;
  password: string;
}) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { error } = await supabaseAdmin.auth.admin.createUser({
    email: credentials.email,
    password: credentials.password,
    email_confirm: true,
    role: "authenticated",
    app_metadata: {
      provider: "email",
      providers: ["email"],
    },
  });

  if (!error) {
    return;
  }

  if (!/already registered|already been registered/i.test(error.message)) {
    throw new Error(
      `No fue posible crear el usuario E2E ${credentials.email}: ${error.message}`,
    );
  }

  const existingUserId = await findUserIdByEmail(credentials.email);

  if (!existingUserId) {
    throw new Error(
      `El usuario E2E ${credentials.email} ya existia, pero no pudimos recuperarlo para confirmarlo.`,
    );
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    existingUserId,
    {
      password: credentials.password,
      email_confirm: true,
      role: "authenticated",
      app_metadata: {
        provider: "email",
        providers: ["email"],
      },
    },
  );

  if (updateError) {
    throw new Error(
      `No fue posible confirmar el usuario E2E ${credentials.email}: ${updateError.message}`,
    );
  }
}
