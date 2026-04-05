#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");
const runtimeDir = path.join(rootDir, "data", "runtime");
const envPath = path.join(rootDir, ".env");
const workerDir = path.join(rootDir, "deploy", "workers-proxy");
const workerTomlPath = path.join(workerDir, "wrangler.toml");
const appPidPath = path.join(runtimeDir, "app.pid");
const appLogPath = path.join(runtimeDir, "app.log");
const tunnelPidPath = path.join(runtimeDir, "cloudflared.pid");
const tunnelLogPath = path.join(runtimeDir, "cloudflared.log");

const envFile = await loadEnvFile(envPath);
const env = { ...process.env, ...envFile };

const config = {
  port: Number(env.PORT || 8787),
  host: env.HOST || "127.0.0.1",
  fixedPublicBaseUrl: env.PUBLIC_BASE_URL || "",
  cloudflareApiToken: env.CLOUDFLARE_API_TOKEN || "",
  workerName: env.WORKER_NAME || "profile-share"
};

if (!config.cloudflareApiToken) {
  console.error("Missing CLOUDFLARE_API_TOKEN in .env or environment.");
  process.exit(1);
}

if (!config.fixedPublicBaseUrl.includes(".workers.dev")) {
  console.error("PUBLIC_BASE_URL is not a workers.dev fixed entry. Please configure it first.");
  process.exit(1);
}

await fs.mkdir(runtimeDir, { recursive: true });

const appStatus = await ensureLocalApp();
const upstreamUrl = await restartQuickTunnel();
await writeWorkerToml(upstreamUrl);
const fixedUrl = await deployWorker();

console.log(JSON.stringify({
  ok: true,
  fixed_url: fixedUrl,
  upstream_url: upstreamUrl,
  app: appStatus,
  worker_name: config.workerName
}, null, 2));

async function ensureLocalApp() {
  if (await isAppHealthy()) {
    return {
      started: false,
      status: "already_running"
    };
  }

  await stopPidFileProcess(appPidPath);
  const logHandle = await fs.open(appLogPath, "a");
  const child = spawn("npm", ["start"], {
    cwd: rootDir,
    detached: true,
    stdio: ["ignore", logHandle.fd, logHandle.fd],
    env: process.env
  });
  child.unref();
  await fs.writeFile(appPidPath, String(child.pid), "utf8");
  await logHandle.close();

  await waitFor(async () => isAppHealthy(), 30_000, 1000, "Timed out waiting for local app to start.");
  return {
    started: true,
    status: "started",
    pid: child.pid
  };
}

async function restartQuickTunnel() {
  await stopPidFileProcess(tunnelPidPath);
  await fs.writeFile(tunnelLogPath, "", "utf8");

  const logHandle = await fs.open(tunnelLogPath, "a");
  const child = spawn("cloudflared", ["tunnel", "--url", `http://${config.host}:${config.port}`], {
    cwd: rootDir,
    detached: true,
    stdio: ["ignore", logHandle.fd, logHandle.fd],
    env: process.env
  });
  child.unref();
  await fs.writeFile(tunnelPidPath, String(child.pid), "utf8");
  await logHandle.close();

  return waitFor(async () => {
    const content = await fs.readFile(tunnelLogPath, "utf8").catch(() => "");
    return content.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)?.[0] || "";
  }, 30_000, 1000, "Timed out waiting for cloudflared quick tunnel URL.");
}

async function writeWorkerToml(upstreamUrl) {
  const compatibilityDate = new Date(Date.now() - 60 * 1000).toISOString().slice(0, 10);
  const content = [
    `name = "${config.workerName}"`,
    'main = "worker.js"',
    `compatibility_date = "${compatibilityDate}"`,
    "workers_dev = true",
    "",
    "[vars]",
    `UPSTREAM_BASE_URL = "${upstreamUrl}"`
  ].join("\n");
  await fs.writeFile(workerTomlPath, `${content}\n`, "utf8");
}

async function deployWorker() {
  const result = spawnSync("wrangler", ["deploy"], {
    cwd: workerDir,
    env: {
      ...process.env,
      CLOUDFLARE_API_TOKEN: config.cloudflareApiToken
    },
    encoding: "utf8"
  });

  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  const fixedUrl = output.match(/https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev/i)?.[0] || config.fixedPublicBaseUrl;

  if (result.status !== 0) {
    console.error(output.trim() || "wrangler deploy failed");
    process.exit(result.status || 1);
  }

  if (!fixedUrl) {
    console.error(output.trim() || "Unable to determine deployed workers.dev URL.");
    process.exit(1);
  }

  return fixedUrl;
}

async function isAppHealthy() {
  try {
    const response = await fetch(`http://${config.host}:${config.port}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function stopPidFileProcess(pidFile) {
  try {
    const pid = Number((await fs.readFile(pidFile, "utf8")).trim());
    if (pid) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {}
    }
    await fs.rm(pidFile, { force: true });
  } catch {}
}

async function waitFor(getValue, timeoutMs, intervalMs, errorMessage) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await getValue();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(errorMessage);
}

async function loadEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          const key = line.slice(0, index).trim();
          let value = line.slice(index + 1).trim();
          if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          return [key, value];
        })
    );
  } catch {
    return {};
  }
}
