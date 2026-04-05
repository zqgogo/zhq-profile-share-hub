#!/usr/bin/env node

const args = process.argv.slice(2);
const options = {};

for (let index = 0; index < args.length; index += 2) {
  const key = args[index];
  const value = args[index + 1];
  if (!key?.startsWith("--")) continue;
  options[key.slice(2)] = value ?? "";
}

const baseUrl = process.env.PROFILE_PUBLISHER_BASE_URL || "http://127.0.0.1:8787";
const manage = resolveManageHandle(options, baseUrl);

if (!manage.id || !manage.token || !options.action) {
  console.error("Missing required args. Need --action plus either --manage-url or both --id and --token.");
  process.exit(1);
}

const action = options.action;

try {
  let response;

  if (action === "activate" || action === "deactivate") {
    response = await requestJson(`${baseUrl}/api/profiles/${manage.id}/toggle`, {
      token: manage.token,
      active: action === "activate"
    });
  } else if (action === "reset-usage") {
    response = await requestJson(`${baseUrl}/api/profiles/${manage.id}/reset-quotas`, {
      token: manage.token,
      matchCount: numberOrDefault(options["match-count"], 3),
      chatCount: numberOrDefault(options["chat-count"], 10)
    });
  } else if (action === "regenerate") {
    response = await requestJson(`${baseUrl}/api/profiles/${manage.id}/regenerate`, {
      token: manage.token,
      type: options.type || undefined,
      name: options.name || undefined,
      title: options.title || undefined,
      focus: options.focus || undefined,
      rawInput: options.text || undefined,
      resetCounts: options["reset-counts"] === "true"
    });
  } else {
    console.error(`Unsupported action: ${action}`);
    process.exit(1);
  }

  console.log(JSON.stringify({
    action,
    id: response.id,
    status: response.status,
    type: response.type,
    title: response.title,
    public_url: response.links?.publicUrl,
    manage_url: maskManageUrl(response.links?.manageUrl),
    match_remaining: response.usage?.matchRemaining,
    chat_remaining: response.usage?.chatRemaining
  }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function resolveManageHandle(options, baseUrl) {
  if (options["manage-url"]) {
    try {
      const url = new URL(options["manage-url"], baseUrl);
      const parts = url.pathname.split("/").filter(Boolean);
      return {
        id: parts.at(-1) || "",
        token: url.searchParams.get("token") || ""
      };
    } catch {
      return { id: "", token: "" };
    }
  }

  return {
    id: options.id || "",
    token: options.token || ""
  };
}

async function requestJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

function numberOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function maskManageUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const token = parsed.searchParams.get("token") || "";
    if (token) {
      parsed.searchParams.set("token", `${token.slice(0, 4)}***`);
    }
    return parsed.toString();
  } catch {
    return "manage-url-hidden";
  }
}
