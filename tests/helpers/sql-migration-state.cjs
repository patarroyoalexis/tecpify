/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = process.cwd();
const migrationsDir = path.join(repoRoot, "supabase", "migrations");

const LEGACY_OWNERLESS_FORBIDDEN_TABLE_SPECS = [
  {
    name: "public.legacy_business_ownership_remediations",
    createPattern:
      /create\s+table(?:\s+if\s+not\s+exists)?\s+public\.legacy_business_ownership_remediations\b/i,
    dropPattern: /drop\s+table\s+if\s+exists\s+public\.legacy_business_ownership_remediations\b/i,
  },
  {
    name: "public.legacy_business_ownership_remediation_events",
    createPattern:
      /create\s+table(?:\s+if\s+not\s+exists)?\s+public\.legacy_business_ownership_remediation_events\b/i,
    dropPattern:
      /drop\s+table\s+if\s+exists\s+public\.legacy_business_ownership_remediation_events\b/i,
  },
];

const LEGACY_OWNERLESS_FORBIDDEN_FUNCTION_SPECS = [
  {
    name: "public.set_legacy_business_ownership_remediations_updated_at()",
    createPattern:
      /create(?:\s+or\s+replace)?\s+function\s+public\.set_legacy_business_ownership_remediations_updated_at\s*\(/i,
    dropPattern:
      /drop\s+function\s+if\s+exists\s+public\.set_legacy_business_ownership_remediations_updated_at\(\)\s+cascade/i,
  },
  {
    name: "public.enforce_legacy_business_owner_assignment_via_remediation()",
    createPattern:
      /create(?:\s+or\s+replace)?\s+function\s+public\.enforce_legacy_business_owner_assignment_via_remediation\s*\(/i,
    dropPattern:
      /drop\s+function\s+if\s+exists\s+public\.enforce_legacy_business_owner_assignment_via_remediation\(\)\s+cascade/i,
  },
  {
    name: "public.sync_legacy_business_remediation_after_owner_assignment()",
    createPattern:
      /create(?:\s+or\s+replace)?\s+function\s+public\.sync_legacy_business_remediation_after_owner_assignment\s*\(/i,
    dropPattern:
      /drop\s+function\s+if\s+exists\s+public\.sync_legacy_business_remediation_after_owner_assignment\(\)\s+cascade/i,
  },
  {
    name: "public.request_legacy_business_ownership_remediation(text)",
    createPattern:
      /create(?:\s+or\s+replace)?\s+function\s+public\.request_legacy_business_ownership_remediation\s*\(/i,
    dropPattern:
      /drop\s+function\s+if\s+exists\s+public\.request_legacy_business_ownership_remediation\(text\)\s+cascade/i,
  },
  {
    name: "public.grant_legacy_business_owner_claim(text, text)",
    createPattern:
      /create(?:\s+or\s+replace)?\s+function\s+public\.grant_legacy_business_owner_claim\s*\(/i,
    dropPattern:
      /drop\s+function\s+if\s+exists\s+public\.grant_legacy_business_owner_claim\(text,\s*text\)\s+cascade/i,
  },
  {
    name: "public.claim_legacy_business_ownership(text)",
    createPattern:
      /create(?:\s+or\s+replace)?\s+function\s+public\.claim_legacy_business_ownership\s*\(/i,
    dropPattern:
      /drop\s+function\s+if\s+exists\s+public\.claim_legacy_business_ownership\(text\)\s+cascade/i,
  },
  {
    name: "public.list_current_user_legacy_business_ownership_remediations()",
    createPattern:
      /create(?:\s+or\s+replace)?\s+function\s+public\.list_current_user_legacy_business_ownership_remediations\s*\(/i,
    dropPattern:
      /drop\s+function\s+if\s+exists\s+public\.list_current_user_legacy_business_ownership_remediations\(\)\s+cascade/i,
  },
];

const LEGACY_OWNERLESS_FORBIDDEN_TRIGGER_SPECS = [
  {
    name: "legacy_business_ownership_remediations_set_updated_at",
    createPattern: /create\s+trigger\s+legacy_business_ownership_remediations_set_updated_at\b/i,
    dropPattern:
      /drop\s+trigger\s+if\s+exists\s+legacy_business_ownership_remediations_set_updated_at\b/i,
  },
  {
    name: "businesses_require_legacy_remediation_before_owner_assignment",
    createPattern:
      /create\s+trigger\s+businesses_require_legacy_remediation_before_owner_assignment\b/i,
    dropPattern:
      /drop\s+trigger\s+if\s+exists\s+businesses_require_legacy_remediation_before_owner_assignment\b/i,
  },
  {
    name: "businesses_sync_legacy_remediation_after_owner_assignment",
    createPattern:
      /create\s+trigger\s+businesses_sync_legacy_remediation_after_owner_assignment\b/i,
    dropPattern:
      /drop\s+trigger\s+if\s+exists\s+businesses_sync_legacy_remediation_after_owner_assignment\b/i,
  },
];

const LEGACY_OWNERLESS_AUTHENTICATED_GRANT_SPECS = [
  {
    name: "public.request_legacy_business_ownership_remediation(text) -> authenticated",
    grantPattern:
      /grant\s+execute\s+on\s+function\s+public\.request_legacy_business_ownership_remediation\(text\)\s+to\s+authenticated\b/i,
    revokePattern:
      /revoke\s+all\s+on\s+function\s+public\.request_legacy_business_ownership_remediation\(text\)\s+from\s+public,\s*anon,\s*authenticated\b/i,
    dropPattern:
      /drop\s+function\s+if\s+exists\s+public\.request_legacy_business_ownership_remediation\(text\)\s+cascade/i,
  },
  {
    name: "public.grant_legacy_business_owner_claim(text, text) -> authenticated",
    grantPattern:
      /grant\s+execute\s+on\s+function\s+public\.grant_legacy_business_owner_claim\(text,\s*text\)\s+to\s+authenticated\b/i,
    revokePattern:
      /revoke\s+all\s+on\s+function\s+public\.grant_legacy_business_owner_claim\(text,\s*text\)\s+from\s+public,\s*anon,\s*authenticated\b/i,
    dropPattern:
      /drop\s+function\s+if\s+exists\s+public\.grant_legacy_business_owner_claim\(text,\s*text\)\s+cascade/i,
  },
  {
    name: "public.claim_legacy_business_ownership(text) -> authenticated",
    grantPattern:
      /grant\s+execute\s+on\s+function\s+public\.claim_legacy_business_ownership\(text\)\s+to\s+authenticated\b/i,
    revokePattern:
      /revoke\s+all\s+on\s+function\s+public\.claim_legacy_business_ownership\(text\)\s+from\s+public,\s*anon,\s*authenticated\b/i,
    dropPattern:
      /drop\s+function\s+if\s+exists\s+public\.claim_legacy_business_ownership\(text\)\s+cascade/i,
  },
  {
    name: "public.list_current_user_legacy_business_ownership_remediations() -> authenticated",
    grantPattern:
      /grant\s+execute\s+on\s+function\s+public\.list_current_user_legacy_business_ownership_remediations\(\)\s+to\s+authenticated\b/i,
    revokePattern:
      /revoke\s+all\s+on\s+function\s+public\.list_current_user_legacy_business_ownership_remediations\(\)\s+from\s+public,\s*anon,\s*authenticated\b/i,
    dropPattern:
      /drop\s+function\s+if\s+exists\s+public\.list_current_user_legacy_business_ownership_remediations\(\)\s+cascade/i,
  },
];

const LEGACY_OWNERLESS_REQUIRED_BLOCKER_FUNCTION_SPEC = {
  name: "public.prevent_unsupported_legacy_business_owner_assignment()",
  createPattern:
    /create(?:\s+or\s+replace)?\s+function\s+public\.prevent_unsupported_legacy_business_owner_assignment\s*\(/i,
  dropPattern:
    /drop\s+function\s+if\s+exists\s+public\.prevent_unsupported_legacy_business_owner_assignment\(\)\b/i,
};

const LEGACY_OWNERLESS_REQUIRED_BLOCKER_TRIGGER_SPEC = {
  name: "businesses_block_unsupported_legacy_owner_assignment",
  createPattern: /create\s+trigger\s+businesses_block_unsupported_legacy_owner_assignment\b/i,
  dropPattern:
    /drop\s+trigger\s+if\s+exists\s+businesses_block_unsupported_legacy_owner_assignment\b/i,
};

function testPattern(pattern, source) {
  return new RegExp(pattern.source, pattern.flags).test(source);
}

function getSortedSqlMigrations() {
  return fs
    .readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith(".sql"))
    .sort()
    .map((filename) => ({
      filename,
      source: fs.readFileSync(path.join(migrationsDir, filename), "utf8"),
    }));
}

function collectSqlObjectState(migrations, specification) {
  let state = "absent";
  const transitions = [];

  for (const migration of migrations) {
    if (specification.dropPattern && testPattern(specification.dropPattern, migration.source)) {
      state = "absent";
      transitions.push({ filename: migration.filename, action: "drop" });
    }

    if (specification.createPattern && testPattern(specification.createPattern, migration.source)) {
      state = "present";
      transitions.push({ filename: migration.filename, action: "create" });
    }
  }

  return {
    ...specification,
    state,
    transitions,
    lastTransition: transitions.at(-1) ?? null,
  };
}

function collectExecuteGrantState(migrations, specification) {
  let granted = false;
  const transitions = [];

  for (const migration of migrations) {
    if (specification.dropPattern && testPattern(specification.dropPattern, migration.source)) {
      granted = false;
      transitions.push({ filename: migration.filename, action: "drop" });
    }

    if (specification.revokePattern && testPattern(specification.revokePattern, migration.source)) {
      granted = false;
      transitions.push({ filename: migration.filename, action: "revoke" });
    }

    if (specification.grantPattern && testPattern(specification.grantPattern, migration.source)) {
      granted = true;
      transitions.push({ filename: migration.filename, action: "grant" });
    }
  }

  return {
    ...specification,
    granted,
    transitions,
    lastTransition: transitions.at(-1) ?? null,
  };
}

function getLatestMigrationMatchingPattern(migrations, pattern) {
  const matchedMigration = [...migrations]
    .reverse()
    .find((migration) => testPattern(pattern, migration.source));

  return matchedMigration ?? null;
}

function formatTransitions(transitions) {
  return transitions.length === 0
    ? "sin transiciones"
    : transitions.map((transition) => `${transition.filename}:${transition.action}`).join(" -> ");
}

function getLegacyOwnerlessSqlClosureState() {
  const migrations = getSortedSqlMigrations();
  const forbiddenTables = LEGACY_OWNERLESS_FORBIDDEN_TABLE_SPECS.map((specification) =>
    collectSqlObjectState(migrations, specification),
  );
  const forbiddenFunctions = LEGACY_OWNERLESS_FORBIDDEN_FUNCTION_SPECS.map((specification) =>
    collectSqlObjectState(migrations, specification),
  );
  const forbiddenTriggers = LEGACY_OWNERLESS_FORBIDDEN_TRIGGER_SPECS.map((specification) =>
    collectSqlObjectState(migrations, specification),
  );
  const authenticatedGrantStates = LEGACY_OWNERLESS_AUTHENTICATED_GRANT_SPECS.map(
    (specification) => collectExecuteGrantState(migrations, specification),
  );
  const blockerFunction = collectSqlObjectState(
    migrations,
    LEGACY_OWNERLESS_REQUIRED_BLOCKER_FUNCTION_SPEC,
  );
  const blockerTrigger = collectSqlObjectState(
    migrations,
    LEGACY_OWNERLESS_REQUIRED_BLOCKER_TRIGGER_SPEC,
  );
  const latestBlockerFunctionMigration = blockerFunction.lastTransition
    ? migrations.find((migration) => migration.filename === blockerFunction.lastTransition.filename) ?? null
    : null;
  const latestBlockerTriggerMigration = blockerTrigger.lastTransition
    ? migrations.find((migration) => migration.filename === blockerTrigger.lastTransition.filename) ?? null
    : null;
  const latestLegacySurfaceReference = getLatestMigrationMatchingPattern(
    migrations,
    /legacy_business_ownership_remediation|request_legacy_business_ownership_remediation|grant_legacy_business_owner_claim|claim_legacy_business_ownership|list_current_user_legacy_business_ownership_remediations|prevent_unsupported_legacy_business_owner_assignment|businesses_block_unsupported_legacy_owner_assignment/i,
  );

  return {
    migrations,
    forbiddenTables,
    forbiddenFunctions,
    forbiddenTriggers,
    authenticatedGrantStates,
    blockerFunction: {
      ...blockerFunction,
      latestMigration: latestBlockerFunctionMigration,
    },
    blockerTrigger: {
      ...blockerTrigger,
      latestMigration: latestBlockerTriggerMigration,
    },
    latestLegacySurfaceReference,
  };
}

module.exports = {
  formatTransitions,
  getLegacyOwnerlessSqlClosureState,
  getSortedSqlMigrations,
};
