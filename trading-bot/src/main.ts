import { loadConfig, missingVenueSettings } from "./config.js";

const ORDER_RESPONSE_SCHEMA_VERIFIED = false;
const PORTFOLIO_RESPONSE_SCHEMA_VERIFIED = false;

async function main(): Promise<void> {
  const config = loadConfig();
  const diagnostics = process.argv.includes("--diagnostics");
  const missing = missingVenueSettings(config);

  console.log("MANTHAN EDGE bot diagnostics");
  console.log(`Order execution configured: ${config.tradingEnabled ? "requested" : "disabled (safe default)"}`);
  console.log(`Supabase telemetry: ${config.supabaseUrl ? "configured" : "disabled"}`);
  console.log(`Venue settings present: ${missing.length === 0 ? "yes" : `no (${missing.join(", ")})`}`);
  console.log("Official starter template: not present in the workspace.");
  console.log("Kafka/API connectivity: not tested; no venue connection is made by diagnostics.");

  if (config.tradingEnabled && (!PORTFOLIO_RESPONSE_SCHEMA_VERIFIED || !ORDER_RESPONSE_SCHEMA_VERIFIED)) {
    console.error("Trading is blocked: official portfolio and order response schemas are not available to verify reconciliation and execution.");
    process.exitCode = 1;
    return;
  }
  if (diagnostics) {
    console.log("Readiness: NOT READY (venue connectivity and mandatory pre-flight checks are unverified).");
    return;
  }
  if (missing.length) {
    throw new Error(`Cannot start venue runtime; configure: ${missing.join(", ")}`);
  }
  throw new Error("Venue runtime is intentionally disabled until the official event and portfolio response schemas are verified.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(`Bot startup failed: ${message}`);
  process.exitCode = 1;
});
