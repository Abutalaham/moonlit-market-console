import { existsSync } from "node:fs";
import { loadConfig, missingVenueSettings } from "./config.js";
import { BotRuntime } from "./runtime.js";
import { runVenueCheck } from "./venueCheck.js";

interface CliOptions {
  diagnostics: boolean;
  venueCheck: boolean;
  continuous: boolean;
  maxEvents: number | undefined;
  timeoutMs: number;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    diagnostics: args.includes("--diagnostics"),
    venueCheck: args.includes("--venue-check"),
    continuous: args.includes("--continuous"),
    maxEvents: args.includes("--continuous") ? undefined : 20,
    timeoutMs: 45_000,
  };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--max-events") {
      const value = Number(args[i + 1]);
      if (!Number.isInteger(value) || value < 1)
        throw new Error("--max-events must be followed by a positive integer.");
      options.maxEvents = value;
      i += 1;
    } else if (args[i] === "--timeout-seconds") {
      const value = Number(args[i + 1]);
      if (!Number.isInteger(value) || value < 1 || value > 3600)
        throw new Error("--timeout-seconds must be an integer from 1 to 3600.");
      options.timeoutMs = value * 1000;
      i += 1;
    } else if (!["--diagnostics", "--venue-check", "--continuous"].includes(args[i]!)) {
      throw new Error(`Unknown option: ${args[i]}`);
    }
  }
  if (options.continuous && args.includes("--max-events"))
    throw new Error("Use either --continuous or --max-events, not both.");
  if (options.diagnostics && options.venueCheck)
    throw new Error("Use either --diagnostics or --venue-check.");
  return options;
}

async function main(): Promise<void> {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const options = parseArgs(process.argv.slice(2));
  const config = loadConfig();

  if (options.venueCheck) {
    const passed = await runVenueCheck(config);
    if (!passed) process.exitCode = 1;
    return;
  }

  if (options.diagnostics) {
    const missing = missingVenueSettings(config);
    console.log("MANTHAN EDGE local diagnostics");
    console.log("Order submission: LOCKED OFF in this phase.");
    console.log(`Supabase telemetry: ${config.supabaseUrl ? "configured" : "disabled"}`);
    console.log(`Venue settings present: ${missing.length === 0 ? "yes" : `no (${missing.join(", ")})`}`);
    console.log("Kafka/API connectivity: run `npm run venue:check` for bounded read-only checks.");
    console.log("Readiness: NOT READY until actual venue schemas, universe and portfolio are verified.");
    return;
  }

  if (config.tradingEnabled) throw new Error("Live order submission is locked off in this phase.");
  const runtime = new BotRuntime(config);
  await runtime.start(options.maxEvents, options.timeoutMs);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(`Bot startup failed: ${message}`);
  process.exitCode = 1;
});
