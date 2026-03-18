type DebugMeta = Record<string, unknown>;

const isDevelopment = process.env.NODE_ENV !== "production";

function safePrint(method: "info" | "warn" | "error", message: string, meta?: DebugMeta) {
  if (!isDevelopment) {
    return;
  }

  if (meta && Object.keys(meta).length > 0) {
    console[method](message, meta);
    return;
  }

  console[method](message);
}

export function debugLog(message: string, meta?: DebugMeta) {
  safePrint("info", message, meta);
}

export function debugWarn(message: string, meta?: DebugMeta) {
  safePrint("warn", message, meta);
}

export function debugError(message: string, meta?: DebugMeta) {
  safePrint("error", message, meta);
}
