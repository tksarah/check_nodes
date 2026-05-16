import { loadEnvConfig } from "@next/env";
import { assertDatabaseConfig, getAdminPassword } from "@/lib/config";

loadEnvConfig(process.cwd());
const mutableEnv = process.env as Record<string, string | undefined>;
mutableEnv.NODE_ENV = "production";
delete mutableEnv.NEXT_PHASE;

const role = process.argv[2] ?? "web";

try {
  assertDatabaseConfig();

  if (role === "web") {
    getAdminPassword();
  }

  console.log(`Runtime configuration is valid for ${role}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
