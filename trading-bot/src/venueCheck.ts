import { Socket } from "node:net";
import type { BotConfig } from "./config.js";
import { CompetitionClient } from "./api/competitionClient.js";
import { RateLimiter } from "./utils/rateLimiter.js";

interface CheckResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP" | "WARN";
  detail: string;
}

export async function runVenueCheck(config: BotConfig): Promise<boolean> {
  const checks: CheckResult[] = [];
  const portal = await checkPortal(config.venuePortalUrl);
  checks.push(portal.result);
  if (portal.docsFound > 0) {
    checks.push({
      name: "Portal API documentation",
      status: "WARN",
      detail: `Found ${portal.docsFound} same-origin documentation link(s); fetch the portal when reachable to verify schemas.`,
    });
  }

  if (!config.botApiBase) {
    checks.push({
      name: "GET /api/v1/stage",
      status: "SKIP",
      detail: "BOT_API_BASE is not configured; service host was not inferred from the portal IP.",
    });
    checks.push({
      name: "GET /api/v1/simulation/clock",
      status: "SKIP",
      detail: "BOT_API_BASE is not configured; service host was not inferred from the portal IP.",
    });
    checks.push({
      name: "Authenticated GET /api/v1/stocks",
      status: "SKIP",
      detail: "BOT_API_BASE is not configured.",
    });
  } else {
    let client: CompetitionClient | null = null;
    try {
      client = new CompetitionClient(
        config.botApiBase,
        config.botAccessToken,
        new RateLimiter(config.requestsPerMinuteLimit),
      );
    } catch (error) {
      const detail = safeError(error);
      checks.push({ name: "GET /api/v1/stage", status: "FAIL", detail });
      checks.push({ name: "GET /api/v1/simulation/clock", status: "FAIL", detail });
      checks.push({ name: "Authenticated GET /api/v1/stocks", status: "FAIL", detail });
    }

    if (client) {
      try {
        const stage = await client.getStage();
        checks.push({
          name: "GET /api/v1/stage",
          status: "PASS",
          detail: `Recognized stage=${stage.stage}, status=${stage.status}.`,
        });
      } catch (error) {
        checks.push({ name: "GET /api/v1/stage", status: "FAIL", detail: safeError(error) });
      }

      try {
        const clock = await client.getClock();
        checks.push({
          name: "GET /api/v1/simulation/clock",
          status: "WARN",
          detail: `JSON response received; clock schema remains unverified (${clock.schemaVerified ? "verified" : "pending official docs"}).`,
        });
      } catch (error) {
        checks.push({
          name: "GET /api/v1/simulation/clock",
          status: "FAIL",
          detail: safeError(error),
        });
      }

      if (!config.botAccessToken) {
        checks.push({
          name: "Authenticated GET /api/v1/stocks",
          status: "SKIP",
          detail: "BOT_ACCESS_TOKEN is not configured; no authenticated request was sent.",
        });
      } else {
        try {
          const response = await client.getStocks();
          checks.push({
            name: "Authenticated GET /api/v1/stocks",
            status: "WARN",
            detail: isJsonLike(response)
              ? "JSON response received; stock-universe schema remains unverified."
              : "Response received but does not match an inspectable JSON object/array.",
          });
        } catch (error) {
          checks.push({
            name: "Authenticated GET /api/v1/stocks",
            status: "FAIL",
            detail: safeError(error),
          });
        }
      }
    }
  }

  if (!config.kafkaBrokers.length) {
    checks.push({
      name: "Kafka TCP",
      status: "SKIP",
      detail: "KAFKA_BROKERS is not configured.",
    });
  } else {
    for (const [index, broker] of config.kafkaBrokers.entries()) {
      try {
        await checkTcp(broker, 2000);
        checks.push({ name: `Kafka TCP broker #${index + 1}`, status: "PASS", detail: "TCP connection established." });
      } catch (error) {
        checks.push({ name: `Kafka TCP broker #${index + 1}`, status: "FAIL", detail: safeError(error) });
      }
    }
  }

  const groupId = config.teamUsername ? `group-${config.teamUsername}` : "";
  const groupOk = /^group-[a-zA-Z0-9._-]+$/.test(groupId);
  checks.push({
    name: "Kafka consumer group",
    status: groupOk ? "PASS" : "FAIL",
    detail: groupOk ? "Configured group ID format is group-<TEAM_USERNAME>." : "TEAM_USERNAME is missing.",
  });

  for (const check of checks)
    console.log(`[${check.status}] ${check.name}: ${check.detail}`);
  const ready = checks.every((check) => check.status === "PASS");
  console.log(`Venue diagnostics: ${ready ? "ALL CHECKS PASSED" : "NOT READY (see check results above)"}.`);
  return ready;
}

async function checkPortal(url: string): Promise<{ result: CheckResult; docsFound: number }> {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(2500),
      headers: { Accept: "text/html" },
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok)
      return {
        result: { name: "Participant portal", status: "FAIL", detail: `HTTP ${response.status}.` },
        docsFound: 0,
      };
    if (!contentType.toLowerCase().includes("text/html"))
      return {
        result: {
          name: "Participant portal",
          status: "WARN",
          detail: `HTTP ${response.status}; unexpected content type, not treated as an API response.`,
        },
        docsFound: 0,
      };
    const html = await response.text();
    const docsFound = findDocsLinks(html, url);
    return {
      result: {
        name: "Participant portal",
        status: "PASS",
        detail: `HTTP ${response.status}; portal HTML reachable (not treated as an API response).`,
      },
      docsFound,
    };
  } catch (error) {
    return {
      result: { name: "Participant portal", status: "FAIL", detail: safeError(error) },
      docsFound: 0,
    };
  }
}

function findDocsLinks(html: string, base: string): number {
  const root = new URL(base);
  const links = html.matchAll(/href=["']([^"']+)["']/gi);
  const paths = new Set<string>();
  for (const match of links) {
    try {
      const link = new URL(match[1]!, root);
      if (
        link.origin === root.origin &&
        /api|doc|swagger|openapi|starter|guide/i.test(link.pathname)
      ) paths.add(link.pathname);
    } catch {
      continue;
    }
  }
  return paths.size;
}

async function checkTcp(broker: string, timeoutMs: number): Promise<void> {
  let url: URL;
  try {
    url = new URL(broker.includes("://") ? broker : `tcp://${broker}`);
  } catch {
    throw new Error("Broker address must be host:port.");
  }
  const port = Number(url.port);
  if (!url.hostname || !Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Broker address must be host:port.");
  await new Promise<void>((resolve, reject) => {
    const socket = new Socket();
    const done = (error?: Error) => {
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };
    socket.setTimeout(timeoutMs, () => done(new Error("TCP connection timed out.")));
    socket.once("error", () => done(new Error("TCP connection failed or was refused.")));
    socket.connect(port, url.hostname, () => done());
  });
}

function isJsonLike(value: unknown): boolean {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

function safeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError")
      return "Connection timed out.";
    return error.message.replace(/https?:\/\/[^\s]+/g, "[configured endpoint]");
  }
  return "Unknown connection error.";
}
