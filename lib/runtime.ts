import { getNodeEnv } from "@/lib/env";

export function isProductionRuntime() {
  return getNodeEnv() === "production";
}
