import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import os from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const storageDir = path.join(rootDir, "data", "profiles");

await loadEnvFile(path.join(rootDir, ".env"));

const openClawConfigPath = process.env.OPENCLAW_CONFIG_PATH || path.join(os.homedir(), ".openclaw", "openclaw.json");

const sharedAiConfig = await loadSharedAiConfig();

const defaultPort = Number(process.env.PORT || 8787);
const defaultHost = process.env.HOST || "127.0.0.1";
const localBaseUrl = `http://${defaultHost}:${defaultPort}`;
const detectedExternalUrl = process.env.RENDER_EXTERNAL_URL || "";

const config = {
  port: defaultPort,
  host: defaultHost,
  baseUrl: process.env.BASE_URL || detectedExternalUrl || localBaseUrl,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || process.env.BASE_URL || detectedExternalUrl || localBaseUrl,
  adminToken: process.env.ADMIN_TOKEN || "",
  adminSessionSecret: process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_TOKEN || crypto.randomBytes(24).toString("hex"),
  aiApiUrl: process.env.AI_API_URL || sharedAiConfig.aiApiUrl || "",
  aiApiKey: process.env.AI_API_KEY || sharedAiConfig.aiApiKey || "",
  aiModel: process.env.AI_MODEL || sharedAiConfig.aiModel || "",
  aiExtraHeaders: {
    ...sharedAiConfig.aiExtraHeaders,
    ...parseHeaderString(process.env.AI_EXTRA_HEADERS || "")
  },
  aiSource: process.env.AI_API_URL || process.env.AI_API_KEY || process.env.AI_MODEL ? "env" : sharedAiConfig.source || "none"
};

const profileTypes = {
  resume: {
    label: "简历",
    hero: "Professional Resume",
    subtitle: "把经历、技能和项目打造成一页能直接转发的职业卡片。",
    accent: "#0d8eff",
    layout: "resume"
  },
  matchmaking: {
    label: "相亲交友",
    hero: "Relationship Profile",
    subtitle: "用更自然、可信的方式展示你的背景、相处风格和关系期待。",
    accent: "#f56b88",
    layout: "matchmaking"
  }
};

const staticTypes = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8"
};

await fs.mkdir(storageDir, { recursive: true });

const adminSessions = new Map();
const rateLimitStore = new Map();

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", config.baseUrl);
    const { pathname } = url;

    if (pathname.startsWith("/public/")) {
      return serveStatic(pathname.replace("/public/", ""), res);
    }

    if (pathname === "/api/admin/session" && req.method === "POST") {
      assertRateLimit(req, "admin-login", 10, 10 * 60 * 1000);
      const body = await readJson(req);
      if (!config.adminToken) {
        return sendJson(res, 200, { ok: true, open: true });
      }
      if (String(body.password || "") !== config.adminToken) {
        return sendJson(res, 401, { error: "后台口令错误" });
      }
      const session = createAdminSession();
      return sendJson(res, 200, { ok: true }, {
        "Set-Cookie": buildAdminCookie(session.token)
      });
    }

    if (pathname === "/api/admin/session" && req.method === "DELETE") {
      return sendJson(res, 200, { ok: true }, {
        "Set-Cookie": expireAdminCookie()
      });
    }

    if (pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        now: new Date().toISOString(),
        publicBaseUrl: config.publicBaseUrl,
        aiEnabled: Boolean(config.aiApiUrl && config.aiApiKey && config.aiModel),
        aiSource: config.aiSource,
        aiModel: config.aiModel || ""
      });
    }

    if (pathname === "/api/profiles" && req.method === "POST") {
      assertRateLimit(req, "create-profile", 20, 10 * 60 * 1000);
      const body = await readJson(req);
      const profile = await buildProfile(body);
      await saveProfile(profile);
      return sendJson(res, 201, publicPayload(profile, true));
    }

    if (pathname === "/api/admin/profiles" && req.method === "GET") {
      assertAdminAccess(url, req);
      return sendJson(res, 200, await buildAdminPayload());
    }

    const profileIdMatch = pathname.match(/^\/api\/profiles\/([a-z0-9-]+)$/);
    const adminToggleMatch = pathname.match(/^\/api\/admin\/profiles\/([a-z0-9-]+)\/toggle$/);
    const adminResetQuotaMatch = pathname.match(/^\/api\/admin\/profiles\/([a-z0-9-]+)\/reset-quotas$/);
    const publicDataMatch = pathname.match(/^\/api\/profiles\/([a-z0-9-]+)\/public$/);
    const toggleMatch = pathname.match(/^\/api\/profiles\/([a-z0-9-]+)\/toggle$/);
    const regenerateMatch = pathname.match(/^\/api\/profiles\/([a-z0-9-]+)\/regenerate$/);
    const resetQuotaMatch = pathname.match(/^\/api\/profiles\/([a-z0-9-]+)\/reset-quotas$/);
    const sharesMatch = pathname.match(/^\/api\/profiles\/([a-z0-9-]+)\/shares$/);
    const matchApiMatch = pathname.match(/^\/api\/profiles\/([a-z0-9-]+)\/match$/);
    const chatApiMatch = pathname.match(/^\/api\/profiles\/([a-z0-9-]+)\/chat$/);

    if (publicDataMatch && req.method === "GET") {
      const profile = await loadProfile(publicDataMatch[1]);
      return sendJson(res, 200, publicPayload(profile, false, url.searchParams.get("share")));
    }

    if (profileIdMatch && req.method === "GET") {
      const profile = await loadProfile(profileIdMatch[1]);
      const token = url.searchParams.get("token");
      const withManage = token && token === profile.editToken;
      return sendJson(res, 200, publicPayload(profile, withManage));
    }

    if (profileIdMatch && req.method === "PUT") {
      const profile = await loadProfile(profileIdMatch[1]);
      const body = await readJson(req);
      assertToken(profile, body.token);
      const updated = await updateProfile(profile, body);
      await saveProfile(updated);
      return sendJson(res, 200, publicPayload(updated, true));
    }

    if (toggleMatch && req.method === "POST") {
      const profile = await loadProfile(toggleMatch[1]);
      const body = await readJson(req);
      assertToken(profile, body.token);
      profile.status = body.active ? "active" : "inactive";
      profile.updatedAt = new Date().toISOString();
      await saveProfile(profile);
      return sendJson(res, 200, publicPayload(profile, true));
    }

    if (adminToggleMatch && req.method === "POST") {
      assertRateLimit(req, "admin-write", 120, 10 * 60 * 1000);
      assertAdminAccess(url, req);
      const profile = await loadProfile(adminToggleMatch[1]);
      const body = await readJson(req);
      profile.status = body.active ? "active" : "inactive";
      profile.updatedAt = new Date().toISOString();
      await saveProfile(profile);
      return sendJson(res, 200, summarizeProfile(profile));
    }

    if (regenerateMatch && req.method === "POST") {
      const profile = await loadProfile(regenerateMatch[1]);
      const body = await readJson(req);
      assertToken(profile, body.token);
      const updated = await updateProfile(profile, { ...body, regenerate: true });
      if (body.resetCounts) {
        updated.usage.matchRemaining = 3;
        updated.usage.chatRemaining = 10;
      }
      updated.updatedAt = new Date().toISOString();
      await saveProfile(updated);
      return sendJson(res, 200, publicPayload(updated, true));
    }

    if (resetQuotaMatch && req.method === "POST") {
      const profile = await loadProfile(resetQuotaMatch[1]);
      const body = await readJson(req);
      assertToken(profile, body.token);
      profile.usage.matchRemaining = Number.isFinite(body.matchCount) ? body.matchCount : 3;
      profile.usage.chatRemaining = Number.isFinite(body.chatCount) ? body.chatCount : 10;
      profile.updatedAt = new Date().toISOString();
      await saveProfile(profile);
      return sendJson(res, 200, publicPayload(profile, true));
    }

    if (adminResetQuotaMatch && req.method === "POST") {
      assertRateLimit(req, "admin-write", 120, 10 * 60 * 1000);
      assertAdminAccess(url, req);
      const profile = await loadProfile(adminResetQuotaMatch[1]);
      const body = await readJson(req);
      profile.usage.matchRemaining = Number.isFinite(body.matchCount) ? body.matchCount : 3;
      profile.usage.chatRemaining = Number.isFinite(body.chatCount) ? body.chatCount : 10;
      profile.updatedAt = new Date().toISOString();
      await saveProfile(profile);
      return sendJson(res, 200, summarizeProfile(profile));
    }

    if (sharesMatch && req.method === "POST") {
      const profile = await loadProfile(sharesMatch[1]);
      const body = await readJson(req);
      assertToken(profile, body.token);
      const share = createShare(profile, body.label);
      profile.shares.push(share);
      profile.updatedAt = new Date().toISOString();
      await saveProfile(profile);
      return sendJson(res, 201, {
        shareUrl: `${config.publicBaseUrl}/p/${profile.id}?share=${share.token}`,
        chatUrl: `${config.publicBaseUrl}/chat/${profile.id}?share=${share.token}`,
        share
      });
    }

    if (matchApiMatch && req.method === "POST") {
      assertRateLimit(req, "public-match", 30, 10 * 60 * 1000);
      const profile = await loadProfile(matchApiMatch[1]);
      ensurePublicAvailable(profile);
      const body = await readJson(req);
      const shareView = resolveShare(profile, body.shareToken || url.searchParams.get("share"));
      const usageRef = shareView?.usage || profile.usage;
      const logsRef = shareView?.logs || profile.logs;
      if (usageRef.matchRemaining <= 0) {
        return sendJson(res, 429, { error: "匹配次数已用完" });
      }
      const result = await generateAnalysis(profile, body.message || "");
      usageRef.matchRemaining -= 1;
      profile.updatedAt = new Date().toISOString();
      logsRef.match.push({
        at: new Date().toISOString(),
        input: body.message || "",
        result
      });
      await saveProfile(profile);
      return sendJson(res, 200, {
        result,
        remaining: usageRef.matchRemaining
      });
    }

    if (chatApiMatch && req.method === "POST") {
      assertRateLimit(req, "public-chat", 60, 10 * 60 * 1000);
      const profile = await loadProfile(chatApiMatch[1]);
      ensurePublicAvailable(profile);
      const body = await readJson(req);
      const shareView = resolveShare(profile, body.shareToken || url.searchParams.get("share"));
      const usageRef = shareView?.usage || profile.usage;
      const logsRef = shareView?.logs || profile.logs;
      if (usageRef.chatRemaining <= 0) {
        return sendJson(res, 429, { error: "聊天次数已用完" });
      }
      const result = await generateChatReply(profile, body.message || "");
      usageRef.chatRemaining -= 1;
      profile.updatedAt = new Date().toISOString();
      logsRef.chat.push({
        at: new Date().toISOString(),
        input: body.message || "",
        result
      });
      await saveProfile(profile);
      return sendJson(res, 200, {
        result,
        remaining: usageRef.chatRemaining
      });
    }

    const publicPageMatch = pathname.match(/^\/p\/([a-z0-9-]+)$/);
    const managePageMatch = pathname.match(/^\/manage\/([a-z0-9-]+)$/);
    const chatPageMatch = pathname.match(/^\/chat\/([a-z0-9-]+)$/);

    if (pathname === "/") {
      return sendHtml(res, renderAppShell("home", null));
    }

    if (pathname === "/admin") {
      if (config.adminToken && !hasAdminAccess(url, req)) {
        return sendHtml(res, renderAppShell("admin-login", {
          adminProtected: true,
          loginUrl: "/api/admin/session"
        }));
      }
      return sendHtml(res, renderAppShell("admin", await buildAdminPayload()));
    }

    if (publicPageMatch) {
      const profile = await loadProfile(publicPageMatch[1]);
      return sendHtml(res, renderAppShell("public", publicPayload(profile, false, url.searchParams.get("share"))));
    }

    if (managePageMatch) {
      const profile = await loadProfile(managePageMatch[1]);
      const token = url.searchParams.get("token");
      if (token !== profile.editToken) {
        return sendHtml(res, renderMessagePage("链接无效或缺少管理密钥。"));
      }
      return sendHtml(res, renderAppShell("manage", publicPayload(profile, true)));
    }

    if (chatPageMatch) {
      const profile = await loadProfile(chatPageMatch[1]);
      return sendHtml(res, renderAppShell("chat", publicPayload(profile, false, url.searchParams.get("share"))));
    }

    sendHtml(res, renderMessagePage("页面不存在。"), 404);
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode || 500, {
      error: error.message || "服务器异常"
    });
  }
});

if (process.env.NO_LISTEN !== "1") {
  server.listen(config.port, config.host, () => {
    console.log(`Profile studio running at ${config.baseUrl}`);
  });
}

async function buildProfile(input) {
  const type = normalizeType(input.type);
  const id = crypto.randomUUID();
  const editToken = crypto.randomBytes(18).toString("hex");
  const rawInput = String(input.rawInput || "").trim();
  const title = String(input.title || "").trim() || defaultTitle(type, input.name);
  const name = String(input.name || "").trim() || "未命名";
  const focus = String(input.focus || "").trim();
  const photoDataUrl = normalizePhotoDataUrl(input.photoDataUrl || "");
  const generated = await generateProfileContent({ type, rawInput, title, name, focus });
  const createdAt = new Date().toISOString();

  return {
    id,
    editToken,
    type,
    title,
    name,
    focus,
    photoDataUrl,
    rawInput,
    status: "active",
    createdAt,
    updatedAt: createdAt,
    usage: {
      matchRemaining: 3,
      chatRemaining: 10
    },
    generated,
    logs: {
      match: [],
      chat: []
    },
    shares: []
  };
}

async function updateProfile(profile, input) {
  const type = normalizeType(input.type || profile.type);
  const rawInput = String(input.rawInput ?? profile.rawInput).trim();
  const title = String(input.title ?? profile.title).trim() || defaultTitle(type, input.name || profile.name);
  const name = String(input.name ?? profile.name).trim() || profile.name;
  const focus = String(input.focus ?? profile.focus).trim();
  const photoDataUrl = input.photoDataUrl !== undefined
    ? normalizePhotoDataUrl(input.photoDataUrl || "")
    : (profile.photoDataUrl || "");
  const generated = await generateProfileContent({ type, rawInput, title, name, focus });

  return {
    ...profile,
    type,
    rawInput,
    title,
    name,
    focus,
    photoDataUrl,
    generated,
    updatedAt: new Date().toISOString()
  };
}

async function generateProfileContent({ type, rawInput, title, name, focus }) {
  const fallback = buildFallbackProfile({ type, rawInput, title, name, focus });
  if (!config.aiApiUrl || !config.aiApiKey || !config.aiModel) {
    return fallback;
  }

  try {
    const aiJson = await callAiJson({
      system: "你是一个资料页面生成器。只输出合法 JSON，不要输出 Markdown。",
      user: `
请根据输入资料生成一个用于分享网页的结构化资料。
类型: ${type}
姓名: ${name}
标题: ${title}
重点: ${focus || "无"}
原始资料:
${rawInput}

输出 JSON 结构:
{
  "heroLine": "一行亮点",
  "summary": "80-160字简介",
  "tags": ["标签1", "标签2"],
  "sections": [
    { "title": "版块标题", "items": ["要点1", "要点2", "要点3"] }
  ],
  "chatPrompts": ["适合聊天破冰的提示1", "提示2", "提示3"]
}
      `
    });

    return normalizeGenerated(aiJson, fallback);
  } catch (error) {
    console.warn("AI generate failed, fallback used:", error.message);
    return fallback;
  }
}

async function generateAnalysis(profile, message) {
  const fallback = buildFallbackAnalysis(profile, message);
  if (!config.aiApiUrl || !config.aiApiKey || !config.aiModel) {
    return fallback;
  }

  try {
    const aiJson = await callAiJson({
      system: "你是资料匹配分析助手。只输出合法 JSON，不要输出 Markdown。",
      user: `
请结合资料和用户问题，给出简明匹配分析。
资料类型: ${profile.type}
资料标题: ${profile.title}
资料原始输入:
${profile.rawInput}
资料内容:
${JSON.stringify(profile.generated, null, 2)}

用户问题:
${message}

输出 JSON:
{
  "score": "0-100的字符串",
  "headline": "一句总结",
  "dimensions": [
    { "name": "维度名", "score": "0-100", "summary": "该维度的一句话分析" }
  ],
  "bullets": ["分析1", "分析2", "分析3"],
  "warning": "一句风险提醒，若无则填空字符串"
}
      `
    });
    return {
      score: aiJson.score || fallback.score,
      headline: aiJson.headline || fallback.headline,
      dimensions: Array.isArray(aiJson.dimensions) && aiJson.dimensions.length
        ? aiJson.dimensions.slice(0, 5).map((item) => ({
          name: item.name || "综合维度",
          score: item.score || "",
          summary: item.summary || ""
        }))
        : fallback.dimensions,
      bullets: Array.isArray(aiJson.bullets) && aiJson.bullets.length ? aiJson.bullets.slice(0, 4) : fallback.bullets,
      warning: aiJson.warning || fallback.warning
    };
  } catch (error) {
    console.warn("AI analysis failed, fallback used:", error.message);
    return fallback;
  }
}

async function generateChatReply(profile, message) {
  const fallback = buildFallbackChat(profile, message);
  if (!config.aiApiUrl || !config.aiApiKey || !config.aiModel) {
    return fallback;
  }

  try {
    const aiJson = await callAiJson({
      system: "你是资料页中的访客交流助手。只输出合法 JSON，不要输出 Markdown。",
      user: `
你需要根据资料设定，回复一段自然、礼貌、适合首次了解的聊天内容。
资料类型: ${profile.type}
资料原始输入:
${profile.rawInput}
资料摘要:
${JSON.stringify(profile.generated, null, 2)}

已有聊天历史:
${JSON.stringify((profile.logs?.chat || []).slice(-8), null, 2)}

访客消息:
${message}

输出 JSON:
{
  "reply": "80字以内回复",
  "tone": "一句语气说明"
}
      `
    });
    return {
      reply: aiJson.reply || fallback.reply,
      tone: aiJson.tone || fallback.tone
    };
  } catch (error) {
    console.warn("AI chat failed, fallback used:", error.message);
    return fallback;
  }
}

async function callAiJson({ system, user }) {
  const response = await fetch(config.aiApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.aiApiKey}`,
      ...config.aiExtraHeaders
    },
    body: JSON.stringify({
      model: config.aiModel,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI empty response");
  }
  return JSON.parse(content);
}

async function loadSharedAiConfig() {
  try {
    const raw = await fs.readFile(openClawConfigPath, "utf8");
    const parsed = JSON.parse(raw);
    const primary = parsed?.agents?.defaults?.model?.primary;
    if (!primary || !primary.includes("/")) {
      return {};
    }

    const [providerId, modelId] = primary.split("/", 2);
    const provider = parsed?.models?.providers?.[providerId];
    if (!provider?.baseUrl || !provider?.apiKey) {
      return {};
    }

    return {
      aiApiUrl: toChatCompletionsUrl(provider.baseUrl),
      aiApiKey: provider.apiKey,
      aiModel: modelId,
      aiExtraHeaders: {},
      source: `openclaw:${providerId}`
    };
  } catch {
    return {};
  }
}

function toChatCompletionsUrl(baseUrl) {
  const clean = String(baseUrl || "").replace(/\/+$/, "");
  if (clean.endsWith("/chat/completions")) {
    return clean;
  }
  if (clean.endsWith("/v1")) {
    return `${clean}/chat/completions`;
  }
  return `${clean}/chat/completions`;
}

function buildFallbackProfile({ type, rawInput, title, name, focus }) {
  const lines = rawInput
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const keywords = extractTags(rawInput, type);

  if (type === "resume") {
    return {
      heroLine: `${name} 的职业亮点`,
      summary: `${name} 专注于 ${focus || "岗位匹配与项目表达"}。这是一份为转发和快速沟通优化的简历页面，便于用人方快速查看关键经历、技能与项目成果。`,
      suggestion: "建议定位：直接用于求职和招聘沟通",
      tags: keywords,
      sections: [
        { title: "核心技能", items: pickLines(lines, ["技术", "技能", "擅长", "stack"], 4, ["沟通协作", "项目推进", "结果导向"]) },
        { title: "工作经历", items: pickLines(lines, ["公司", "任职", "工作", "负责"], 4, ["可在此展示公司、岗位、时间与关键成绩"]) },
        { title: "项目成果", items: pickLines(lines, ["项目", "负责", "上线", "增长"], 4, ["建议填写项目背景、职责、结果和量化数据"]) }
      ],
      chatPrompts: ["你最近一个项目里最核心的职责是什么？", "如果团队招这个岗位，你最擅长解决哪类问题？", "你觉得自己最有竞争力的一段经历是哪段？"]
    };
  }

  if (type === "matchmaking" || type === "friendship") {
    return {
      heroLine: `${name} 的相亲交友资料卡`,
      summary: `${name} 希望用一页清楚展示自己的成长背景、生活状态与相处期待。${focus ? `当前更关注 ${focus}。` : ""} 页面支持适度互动，但次数受控，方便安全转发。`,
      suggestion: suggestRelationshipTone(rawInput, focus),
      tags: keywords,
      sections: [
        { title: "基本信息", items: pickLines(lines, ["年龄", "身高", "城市", "学历", "工作"], 5, ["建议填写年龄、城市、学历、工作、家庭情况"]) },
        { title: "性格与经历", items: pickLines(lines, ["性格", "爱好", "经历", "家庭"], 4, ["建议写性格特点、成长经历、兴趣和价值观"]) },
        { title: "关系期待", items: pickLines(lines, ["希望", "期待", "择偶", "理想"], 4, ["建议写希望对方的生活方式、沟通方式和长期规划"]) }
      ],
      chatPrompts: ["你平时更喜欢安静一点还是热闹一点的周末？", "你会比较看重关系里的哪些相处细节？", "如果第一次见面，你通常喜欢从什么话题开始聊？"]
    };
  }
}

function buildFallbackAnalysis(profile, message) {
  if (profile.type === "resume") {
    return {
      score: "78",
      headline: "这份简历适合做第一轮快速判断，优势点比较清晰。",
      dimensions: [
        { name: "工作经历", score: "80", summary: "经历描述能支撑第一轮筛选，但最好再补量化结果。" },
        { name: "技能匹配", score: "76", summary: "技能方向基本明确，适合继续对照岗位要求逐项比较。" },
        { name: "项目相关性", score: "78", summary: "项目经历有表达基础，但还可以继续突出复杂度和结果。"}
      ],
      bullets: [
        "技能、经历、项目已经能支撑初步筛选，但最好补充量化结果。",
        `当前问题更偏向：${message || "岗位技能和经历匹配度"}`,
        "如果岗位要求明确，建议继续对照 JD 看是否有直接相关项目。"
      ],
      warning: "没有岗位描述时，匹配度只能做泛化判断。"
    };
  }

  const zodiacHint = /八字|生肖|属相/.test(message) ? "如果要做八字或生肖分析，需要补充出生年月日时等更完整信息。" : "可先从性格、节奏、价值观和经历稳定性做判断。";
  return {
    score: "82",
    headline: "这份资料适合做初步了解，整体信息表达比较完整。",
    dimensions: [
      { name: "共同话题", score: "81", summary: "兴趣和生活场景能形成初步交流入口，相似和互补都可以成立。" },
      { name: "相处节奏", score: "79", summary: "从慢热、沟通方式、生活习惯可以判断磨合成本。"},
      { name: "价值观与长期性", score: "84", summary: "是否重视真诚、边界感和长期规划，是更关键的判断点。"},
      { name: "生肖参考", score: "65", summary: inferZodiacHint(message) || zodiacHint }
    ],
    bullets: [
      "能快速看出对方的生活状态、沟通方式和基本期待。",
      zodiacHint,
      "建议把长期规划和相处边界写得更具体，匹配判断会更稳。"
    ],
    warning: "仅凭公开资料无法替代真实相处。"
  };
}

function buildFallbackChat(profile, message) {
  return {
    reply: profile.type === "resume"
      ? `我先根据页面资料做了初步了解。关于“${message || "这个岗位"}”，如果你愿意，我可以继续补充更具体的项目细节。`
      : `谢谢你的消息。我看到你提到“${message || "想进一步了解"}”，我们可以先从日常、兴趣或对关系的期待慢慢聊起。`,
    tone: "礼貌、克制、适合首次沟通"
  };
}

function normalizeGenerated(candidate, fallback) {
  return {
    heroLine: candidate.heroLine || fallback.heroLine,
    summary: candidate.summary || fallback.summary,
    suggestion: candidate.suggestion || fallback.suggestion || "",
    tags: Array.isArray(candidate.tags) && candidate.tags.length ? candidate.tags.slice(0, 6) : fallback.tags,
    sections: Array.isArray(candidate.sections) && candidate.sections.length ? candidate.sections.slice(0, 4).map((section) => ({
      title: section.title || "补充信息",
      items: Array.isArray(section.items) && section.items.length ? section.items.slice(0, 6) : ["待补充"]
    })) : fallback.sections,
    chatPrompts: Array.isArray(candidate.chatPrompts) && candidate.chatPrompts.length ? candidate.chatPrompts.slice(0, 4) : fallback.chatPrompts
  };
}

function extractTags(rawInput, type) {
  const words = rawInput
    .split(/[\s,，。；;、:：/]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && word.length <= 8);
  const seed = [...new Set(words)].slice(0, 5);
  const defaults = {
    resume: ["项目经验", "技能梳理", "岗位匹配"],
    matchmaking: ["稳定真诚", "相处期待", "生活状态"],
    friendship: ["稳定真诚", "相处期待", "生活状态"]
  };
  return [...new Set([...seed, ...defaults[type]])].slice(0, 6);
}

function pickLines(lines, includes, limit, defaults) {
  const matched = lines.filter((line) => includes.some((item) => line.includes(item)));
  const source = matched.length ? matched : lines;
  const picked = source.slice(0, limit);
  return picked.length ? picked : defaults;
}

function normalizeType(type) {
  if (type === "friendship") return "matchmaking";
  if (type === "resume" || type === "matchmaking") return type;
  return "resume";
}

function defaultTitle(type, name) {
  const cleanName = String(name || "").trim() || "个人";
  return `${cleanName}${profileTypes[type].label}`;
}

function suggestRelationshipTone(rawInput, focus) {
  const text = `${rawInput} ${focus || ""}`;
  if (/结婚|长期|相亲|成家|婚恋/.test(text)) return "建议定位：偏认真相亲";
  if (/认识|交友|先了解|同频|慢慢聊/.test(text)) return "建议定位：偏轻松交友";
  return "建议定位：先聊天了解，再决定关系方向";
}

function inferZodiacHint(message) {
  const zodiacMap = {
    "1984": "鼠", "1985": "牛", "1986": "虎", "1987": "兔", "1988": "龙", "1989": "蛇",
    "1990": "马", "1991": "羊", "1992": "猴", "1993": "鸡", "1994": "狗", "1995": "猪",
    "1996": "鼠", "1997": "牛", "1998": "虎", "1999": "兔", "2000": "龙", "2001": "蛇",
    "2002": "马", "2003": "羊", "2004": "猴", "2005": "鸡", "2006": "狗", "2007": "猪"
  };
  const year = String(message || "").match(/(19|20)\d{2}/)?.[0];
  if (!year || !zodiacMap[year]) return "";
  return `从出生年份可补充参考生肖${zodiacMap[year]}，适合作为辅助判断。`;
}

async function saveProfile(profile) {
  await fs.writeFile(profileFile(profile.id), JSON.stringify(profile, null, 2), "utf8");
}

async function loadProfile(id) {
  try {
    const content = await fs.readFile(profileFile(id), "utf8");
    return JSON.parse(content);
  } catch {
    const error = new Error("资料不存在");
    error.statusCode = 404;
    throw error;
  }
}

async function listProfiles() {
  const entries = await fs.readdir(storageDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  const profiles = await Promise.all(files.map(async (fileName) => {
    const content = await fs.readFile(path.join(storageDir, fileName), "utf8");
    return JSON.parse(content);
  }));
  return profiles.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
}

async function buildAdminPayload() {
  const profiles = await listProfiles();
  const summaries = profiles.map((profile) => summarizeProfile(profile));
  return {
    stats: {
      total: summaries.length,
      active: summaries.filter((item) => item.status === "active").length,
      inactive: summaries.filter((item) => item.status !== "active").length,
      resume: summaries.filter((item) => item.type === "resume").length,
      matchmaking: summaries.filter((item) => item.type === "matchmaking").length
    },
    profiles: summaries,
    adminProtected: Boolean(config.adminToken)
  };
}

function summarizeProfile(profile) {
  const normalizedType = normalizeType(profile.type);
  return {
    id: profile.id,
    type: normalizedType,
    title: profile.title,
    name: profile.name,
    focus: profile.focus,
    status: profile.status,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    usage: profile.usage,
    shareCount: Array.isArray(profile.shares) ? profile.shares.length : 0,
    logCounts: {
      match: Array.isArray(profile.logs?.match) ? profile.logs.match.length : 0,
      chat: Array.isArray(profile.logs?.chat) ? profile.logs.chat.length : 0
    },
    links: {
      publicUrl: `${config.publicBaseUrl}/p/${profile.id}`,
      chatUrl: `${config.publicBaseUrl}/chat/${profile.id}`,
      manageUrl: `${config.publicBaseUrl}/manage/${profile.id}?token=${profile.editToken}`
    },
    theme: profileTypes[normalizedType]
  };
}

function profileFile(id) {
  return path.join(storageDir, `${id}.json`);
}

function publicPayload(profile, includeToken, shareToken = "") {
  const normalizedType = normalizeType(profile.type);
  const shareView = resolveShare(profile, shareToken);
  const activeUsage = shareView?.usage || profile.usage;
  const activeLogs = shareView?.logs || profile.logs;
  const links = {
    publicUrl: shareView ? `${config.publicBaseUrl}/p/${profile.id}?share=${shareView.token}` : `${config.publicBaseUrl}/p/${profile.id}`,
    manageUrl: `${config.publicBaseUrl}/manage/${profile.id}?token=${profile.editToken}`,
    chatUrl: shareView ? `${config.publicBaseUrl}/chat/${profile.id}?share=${shareView.token}` : `${config.publicBaseUrl}/chat/${profile.id}`
  };
  return {
    id: profile.id,
    type: normalizedType,
    title: profile.title,
    name: profile.name,
    focus: profile.focus,
    photoDataUrl: profile.photoDataUrl,
    rawInput: includeToken ? profile.rawInput : undefined,
    status: profile.status,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    usage: activeUsage,
    generated: profile.generated,
    theme: profileTypes[normalizedType],
    links,
    activeShare: shareView ? {
      id: shareView.id,
      token: shareView.token,
      label: shareView.label
    } : null,
    editToken: includeToken ? profile.editToken : undefined,
    logs: includeToken ? profile.logs : undefined,
    shares: includeToken ? profile.shares : undefined,
    publicLogs: {
      chat: (activeLogs?.chat || []).map((item) => ({
        at: item.at,
        input: item.input,
        result: item.result
      }))
    }
  };
}

function createShare(profile, label) {
  return {
    id: crypto.randomUUID(),
    token: crypto.randomBytes(10).toString("hex"),
    label: String(label || "").trim() || `访客 ${profile.shares.length + 1}`,
    createdAt: new Date().toISOString(),
    usage: {
      matchRemaining: 3,
      chatRemaining: 10
    },
    logs: {
      match: [],
      chat: []
    }
  };
}

function resolveShare(profile, shareToken) {
  if (!shareToken) return null;
  return (profile.shares || []).find((item) => item.token === shareToken) || null;
}

function assertToken(profile, token) {
  if (!token || token !== profile.editToken) {
    const error = new Error("无效的管理凭证");
    error.statusCode = 403;
    throw error;
  }
}

function assertAdminAccess(url, req) {
  if (hasAdminAccess(url, req)) return;
  const error = new Error("无效的后台凭证");
  error.statusCode = 403;
  throw error;
}

function hasAdminAccess(url, req) {
  if (!config.adminToken) return true;
  cleanupAdminSessions();
  const provided = url.searchParams.get("token") || req?.headers["x-admin-token"] || "";
  if (provided && provided === config.adminToken) return true;
  const sessionToken = parseCookies(req?.headers?.cookie || "").psh_admin || "";
  const session = adminSessions.get(sessionToken);
  if (!session) return false;
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(sessionToken);
    return false;
  }
  return true;
}

function createAdminSession() {
  cleanupAdminSessions();
  const token = crypto
    .createHmac("sha256", config.adminSessionSecret)
    .update(`${Date.now()}-${crypto.randomBytes(20).toString("hex")}`)
    .digest("hex");
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  adminSessions.set(token, { expiresAt });
  return { token, expiresAt };
}

function cleanupAdminSessions() {
  const now = Date.now();
  for (const [token, session] of adminSessions.entries()) {
    if (session.expiresAt <= now) {
      adminSessions.delete(token);
    }
  }
}

function buildAdminCookie(token) {
  const parts = [
    `psh_admin=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${7 * 24 * 60 * 60}`
  ];
  if (config.publicBaseUrl.startsWith("https://")) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function expireAdminCookie() {
  return "psh_admin=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    String(cookieHeader || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [key, ...rest] = item.split("=");
        return [key, rest.join("=")];
      })
  );
}

function assertRateLimit(req, scope, limit, windowMs) {
  const key = `${scope}:${clientIp(req)}`;
  const now = Date.now();
  const current = rateLimitStore.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    const error = new Error("请求过于频繁，请稍后再试");
    error.statusCode = 429;
    throw error;
  }
  current.count += 1;
}

function clientIp(req) {
  return String(req?.headers["x-forwarded-for"] || req?.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function ensurePublicAvailable(profile) {
  if (profile.status !== "active") {
    const error = new Error("该资料当前未上线");
    error.statusCode = 403;
    throw error;
  }
}

async function readJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 3 * 1024 * 1024) {
      const error = new Error("请求体过大");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function serveStatic(relPath, res) {
  const safePath = path.normalize(relPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);
  const ext = path.extname(filePath);
  const content = await fs.readFile(filePath);
  res.writeHead(200, {
    ...securityHeaders(),
    "Content-Type": staticTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-cache"
  });
  res.end(content);
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    ...securityHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, html, statusCode = 200, extraHeaders = {}) {
  res.writeHead(statusCode, {
    ...securityHeaders(),
    "Content-Type": "text/html; charset=utf-8",
    ...extraHeaders
  });
  res.end(html);
}

function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  };
}

async function loadEnvFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIndex = line.indexOf("=");
      if (eqIndex <= 0) continue;
      const key = line.slice(0, eqIndex).trim();
      if (!key || process.env[key] !== undefined) continue;
      let value = line.slice(eqIndex + 1).trim();
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Failed to load .env from ${filePath}:`, error.message);
    }
  }
}

function renderAppShell(page, payload) {
  const appPayload = JSON.stringify({
    page,
    payload,
    config: {
      publicBaseUrl: config.publicBaseUrl,
      aiEnabled: Boolean(config.aiApiUrl && config.aiApiKey && config.aiModel),
      adminProtected: Boolean(config.adminToken)
    },
    profileTypes
  }).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Profile Share Hub</title>
    <link rel="stylesheet" href="/public/styles.css" />
  </head>
  <body data-page="${page}">
    <div id="app"></div>
    <script>window.__APP__ = ${appPayload}</script>
    <script type="module" src="/public/app.js"></script>
  </body>
</html>`;
}

function renderMessagePage(message) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <link rel="stylesheet" href="/public/styles.css" />
    <title>Profile Share Hub</title>
  </head>
  <body>
    <main class="message-page">
      <div class="message-card">
        <h1>Profile Share Hub</h1>
        <p>${escapeHtml(message)}</p>
        <a class="primary-button" href="/">返回首页</a>
      </div>
    </main>
  </body>
</html>`;
}

function parseHeaderString(value) {
  if (!value) {
    return {};
  }
  return Object.fromEntries(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [key, ...rest] = item.split(":");
        return [key.trim(), rest.join(":").trim()];
      })
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizePhotoDataUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!text.startsWith("data:image/")) return "";
  if (text.length > 2_500_000) return "";
  return text;
}

export {
  buildProfile,
  updateProfile,
  generateAnalysis,
  generateChatReply,
  publicPayload,
  normalizeType
};
