#!/usr/bin/env node

const args = process.argv.slice(2);
const options = {};

for (let index = 0; index < args.length; index += 2) {
  const key = args[index];
  const value = args[index + 1];
  if (!key?.startsWith("--")) continue;
  options[key.slice(2)] = value || "";
}

const endpoint = process.env.PROFILE_PUBLISHER_URL || "http://127.0.0.1:8787/api/profiles";

if (!options.type || !options.text) {
  console.error("Missing required args: --type and --text");
  process.exit(1);
}

try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: options.type,
      name: options.name || "",
      title: options.title || "",
      focus: options.focus || "",
      rawInput: options.text
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(data.error || "Publish failed");
    process.exit(1);
  }

  console.log(JSON.stringify({
    public_url: data.links.publicUrl,
    manage_url: maskManageUrl(data.links.manageUrl),
    type: data.type,
    title: data.title
  }, null, 2));
} catch (error) {
  console.error(`Unable to reach profile publisher service at ${endpoint}. Start the app first with npm start or npm run dev.`);
  console.error(error.message);
  process.exit(1);
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
