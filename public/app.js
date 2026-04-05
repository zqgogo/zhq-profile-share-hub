const { page, payload, config, profileTypes } = window.__APP__;
const app = document.querySelector("#app");

const typeMeta = {
  resume: {
    intro: "只谈岗位、经历、项目和招聘判断。",
    matchTitle: "岗位匹配分析",
    matchHint: "输入你的招聘需求、岗位 JD，或你想重点比较的工作维度，系统会给出岗位匹配分析。",
    chatTitle: "招聘沟通",
    chatHint: "这里适合聊项目细节、职责范围、协作方式和到岗安排。",
    chatAction: "进入招聘对话",
    examples: [
      "姓名：张三\n目标岗位：iOS 开发工程师\n工作年限：5年\n技术：Swift、Objective-C、RxSwift、Flutter\n经历：负责电商 App、音视频业务、性能优化\n亮点：主导架构升级，启动耗时下降 35%",
      "姓名：李四\n目标岗位：高级前端工程师\n工作年限：6年\n技术：TypeScript、React、Node.js\n项目：中后台、低代码、可视化平台\n亮点：带 4 人小组，推动重构和工程化"
    ]
  },
  matchmaking: {
    intro: "这一页用于相亲和交友场景，由用户自己把握关系节奏。",
    matchTitle: "关系分析",
    matchHint: "输入你的资料，系统会结合当前资料做多维关系分析。",
    chatTitle: "进一步了解",
    chatHint: "聊天独立成页，可回看完整聊天历史，更适合持续交流。",
    chatAction: "进入聊天页",
    examples: [
      "姓名：周衡\n年龄：31\n性别：男\n城市：上海\n身高：178\n学历：硕士\n工作：互联网后端工程师\n爱好：跑步、做饭、看展\n性格：温和理性，真诚稳定\n期待：想先认真认识，合适再往长期关系发展\n出生年份：1994",
      "姓名：林知夏\n年龄：29\n性别：女\n城市：上海\n身高：165\n学历：本科\n工作：品牌策划\n爱好：羽毛球、旅行、看电影、做甜品\n性格：温和细腻，慢热但好相处\n期待：希望遇到真诚可靠、沟通舒服的人\n出生年份：1996"
    ]
  }
};

if (page === "home") renderHome();
if (page === "admin-login") renderAdminLogin(payload);
if (page === "admin") renderAdmin(payload);
if (page === "public") renderPublic(payload);
if (page === "manage") renderManage(payload);
if (page === "chat") renderChat(payload);
ensureLoadingOverlay();

function renderHome() {
  app.innerHTML = `
    <main class="shell shell-home">
      <section class="hero-home">
        <div class="hero-copy-wrap">
          <p class="eyebrow">Profile Share Hub</p>
          <h1>把三种资料，做成三种完全不同的话语系统</h1>
          <p class="hero-copy">简历页只说工作和招聘，相亲交友页只说关系和相处。支持图片、聊天独立页、完整聊天历史、上下线和次数控制。</p>
          <div class="hero-badges">
            <span>招聘 / 相亲交友分流</span>
            <span>支持图片上传</span>
            <span>匹配 3 次</span>
            <span>聊天 10 次</span>
          </div>
        </div>
        <div class="hero-side">
          <div class="mini-panel">
            <strong>${config.aiEnabled ? "AI 已接入" : "AI 未接入"}</strong>
            <p>${config.aiEnabled ? `当前复用模型：${escapeHtml(config.aiModel || "已配置")}` : "现在可以先用，接入后会自动走同一套模型配置。"}</p>
          </div>
          <div class="mini-panel">
            <strong>分享方式</strong>
            <p>公开链接发给别人，管理链接自己留着。后续可以下线、重新生成、重置次数。</p>
          </div>
          <div class="mini-panel">
            <strong>统一后台</strong>
            <p>需要总览全部资料页时，可进入统一管理后台查看在线状态、次数和访客链接。</p>
            <a class="ghost-button" href="/admin">进入后台</a>
          </div>
        </div>
      </section>

      <section class="type-showcase">
        ${Object.entries(profileTypes).map(([key, item]) => `
          <article class="showcase-card ${key}">
            <p class="showcase-label">${item.label}</p>
            <h2>${typeHeadline(key)}</h2>
          </article>
        `).join("")}
      </section>

      <section class="panel create-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Create</p>
            <h2>新建资料页</h2>
          </div>
          <p>可选上传头像或照片，不上传也能生成。</p>
        </div>

        <form id="create-form" class="form-grid">
          <label>
            <span>资料类型</span>
            <select name="type" id="type-select">
              <option value="resume">简历</option>
              <option value="matchmaking">相亲交友</option>
            </select>
          </label>
          <label>
            <span>姓名或称呼</span>
            <input name="name" placeholder="例如：周衡 / Mia" />
          </label>
          <label>
            <span>页面标题</span>
            <input name="title" id="title-input" placeholder="例如：资深工程师简历页" />
          </label>
          <label>
            <span>强调重点</span>
            <input name="focus" id="focus-input" placeholder="例如：岗位匹配 / 真诚稳定 / 轻松同频" />
          </label>

          <label class="full-span">
            <span>是否上传图片</span>
            <div class="toggle-row">
              <input id="enable-photo" type="checkbox" />
              <p class="hint">开启后可上传头像或照片，并展示在资料页头部。</p>
            </div>
          </label>

          <label class="full-span is-hidden" id="photo-field">
            <span>图片上传</span>
            <input id="photo-input" type="file" accept="image/*" />
            <img id="photo-preview" class="photo-preview is-hidden" alt="预览图" />
          </label>

          <label class="full-span">
            <span>原始输入</span>
            <textarea name="rawInput" id="raw-input" rows="12" placeholder="简历请写经历、技能、项目；相亲交友请写基本信息、性格、爱好、期待。"></textarea>
          </label>

          <div class="full-span template-section">
            <div class="section-title">输入模板示例</div>
            <div id="template-list" class="template-list"></div>
          </div>

          <div class="full-span form-help" id="type-help"></div>
          <button class="primary-button" type="submit">生成资料页面</button>
        </form>

        <div id="create-result" class="result-box is-hidden"></div>
      </section>
    </main>
  `;

  const form = document.querySelector("#create-form");
  const resultBox = document.querySelector("#create-result");
  const typeSelect = document.querySelector("#type-select");
  const photoToggle = document.querySelector("#enable-photo");
  const photoField = document.querySelector("#photo-field");
  const photoInput = document.querySelector("#photo-input");
  const photoPreview = document.querySelector("#photo-preview");
  const templateList = document.querySelector("#template-list");
  const rawInput = document.querySelector("#raw-input");
  let photoDataUrl = "";

  syncTypeCopy(typeSelect.value);
  renderTemplates(typeSelect.value, templateList, rawInput);
  typeSelect.addEventListener("change", () => {
    syncTypeCopy(typeSelect.value);
    renderTemplates(typeSelect.value, templateList, rawInput);
  });

  photoToggle.addEventListener("change", () => {
    photoField.classList.toggle("is-hidden", !photoToggle.checked);
    if (!photoToggle.checked) {
      photoDataUrl = "";
      photoInput.value = "";
      photoPreview.classList.add("is-hidden");
      photoPreview.removeAttribute("src");
    }
  });

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    photoDataUrl = await fileToDataUrl(file);
    photoPreview.src = photoDataUrl;
    photoPreview.classList.remove("is-hidden");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setPending(form, true, "生成中...");
    showLoading("正在生成资料页", "AI 正在整理内容、版式和结构，请稍等…");
    const body = Object.fromEntries(new FormData(form).entries());
    body.photoDataUrl = photoToggle.checked ? photoDataUrl : "";

    try {
      const response = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "生成失败");

      resultBox.classList.remove("is-hidden");
      resultBox.innerHTML = `
        <h3>已生成</h3>
        <p>公开链接</p>
        <a href="${data.links.publicUrl}" target="_blank" rel="noreferrer">${data.links.publicUrl}</a>
        <p>管理链接</p>
        <a href="${data.links.manageUrl}" target="_blank" rel="noreferrer">${data.links.manageUrl}</a>
      `;
      form.reset();
      photoField.classList.add("is-hidden");
      photoPreview.classList.add("is-hidden");
      photoPreview.removeAttribute("src");
      photoDataUrl = "";
      syncTypeCopy("resume");
    } catch (error) {
      resultBox.classList.remove("is-hidden");
      resultBox.innerHTML = `<h3>生成失败</h3><p>${escapeHtml(error.message)}</p>`;
    } finally {
      setPending(form, false, "生成资料页面");
      hideLoading();
    }
  });
}

function renderAdminLogin(payload) {
  app.innerHTML = `
    <main class="shell shell-admin-login">
      <section class="panel admin-login-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Admin Login</p>
            <h2>后台登录</h2>
          </div>
          <p>后台和公开页已经做隔离。输入后台口令后才能进入统一管理页。</p>
        </div>
        <form id="admin-login-form" class="form-grid">
          <label class="full-span">
            <span>后台口令</span>
            <input name="password" type="password" placeholder="请输入后台口令" autocomplete="current-password" />
          </label>
          <button class="primary-button" type="submit">进入后台</button>
        </form>
        <div id="admin-login-result" class="result-box is-hidden"></div>
      </section>
    </main>
  `;

  const form = document.querySelector("#admin-login-form");
  const result = document.querySelector("#admin-login-result");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setPending(form, true, "登录中...");
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const response = await fetch(payload?.loginUrl || "/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "登录失败");
      window.location.href = "/admin";
    } catch (error) {
      result.classList.remove("is-hidden");
      result.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    } finally {
      setPending(form, false, "进入后台");
    }
  });
}

function renderAdmin(admin) {
  const profiles = Array.isArray(admin?.profiles) ? admin.profiles : [];
  const filterOptions = [
    { value: "all", label: "全部" },
    { value: "active", label: "仅在线" },
    { value: "inactive", label: "仅下线" },
    { value: "resume", label: "简历" },
    { value: "matchmaking", label: "相亲交友" }
  ];

  app.innerHTML = `
    <main class="shell shell-admin">
      <section class="hero-home compact">
        <div class="hero-copy-wrap">
          <p class="eyebrow">Admin</p>
          <h1>统一管理后台</h1>
          <p class="hero-copy">这里是开发侧总览页，用来统一看当前有哪些资料在线、次数用了多少、有哪些访客专属链接，并快速进入单页管理。</p>
        </div>
        <div class="hero-badges">
          <span>总数 ${admin?.stats?.total || 0}</span>
          <span>在线 ${admin?.stats?.active || 0}</span>
          <span>下线 ${admin?.stats?.inactive || 0}</span>
          <span>简历 ${admin?.stats?.resume || 0}</span>
          <span>相亲交友 ${admin?.stats?.matchmaking || 0}</span>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Console</p>
            <h2>资料页总览</h2>
          </div>
          <p>${config.adminProtected ? "当前后台建议通过 token 方式访问。" : "当前后台未设置独立后台口令，建议后续上线前配置。 "}</p>
        </div>
        <div class="admin-toolbar">
          <label class="admin-filter">
            <span>筛选</span>
            <select id="admin-filter">
              ${filterOptions.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}
            </select>
          </label>
          <div class="admin-toolbar-actions">
            <a class="ghost-button" href="/">返回首页</a>
            ${config.adminProtected ? `<button id="admin-logout" class="ghost-button" type="button">退出后台</button>` : ""}
          </div>
        </div>
        <div id="admin-list" class="admin-grid"></div>
      </section>
    </main>
  `;

  const listNode = document.querySelector("#admin-list");
  const filterNode = document.querySelector("#admin-filter");

  const renderList = () => {
    const value = filterNode.value;
    const filtered = profiles.filter((profile) => matchesAdminFilter(profile, value));
    if (!filtered.length) {
      listNode.innerHTML = `<div class="content-card"><p class="hint">当前筛选条件下没有资料页。</p></div>`;
      return;
    }

    listNode.innerHTML = filtered.map((profile) => `
      <article class="admin-card" data-id="${profile.id}">
        <div class="admin-card-head">
          <div>
            <p class="eyebrow">${escapeHtml(profile.theme?.label || profile.type)}</p>
            <h3>${escapeHtml(profile.title)}</h3>
          </div>
          <span class="admin-status ${profile.status === "active" ? "is-active" : "is-inactive"}">
            ${profile.status === "active" ? "在线" : "下线"}
          </span>
        </div>
        <p class="hint">${escapeHtml(profile.name || "未命名")} · ${escapeHtml(profile.focus || "未设置重点")}</p>
        <div class="admin-meta">
          <span>匹配剩余 ${profile.usage?.matchRemaining ?? 0}</span>
          <span>聊天剩余 ${profile.usage?.chatRemaining ?? 0}</span>
          <span>访客链接 ${profile.shareCount || 0}</span>
          <span>匹配记录 ${profile.logCounts?.match ?? 0}</span>
          <span>聊天记录 ${profile.logCounts?.chat ?? 0}</span>
        </div>
        <div class="admin-times">
          <span>创建：${escapeHtml(formatDateTime(profile.createdAt))}</span>
          <span>更新：${escapeHtml(formatDateTime(profile.updatedAt))}</span>
        </div>
        <div class="admin-actions">
          <a class="ghost-button" href="${profile.links.publicUrl}" target="_blank" rel="noreferrer">公开页</a>
          <a class="ghost-button" href="${profile.links.chatUrl}" target="_blank" rel="noreferrer">聊天页</a>
          <a class="ghost-button" href="${profile.links.manageUrl}" target="_blank" rel="noreferrer">单页管理</a>
          <button class="ghost-button admin-toggle" data-id="${profile.id}" data-active="${profile.status === "active" ? "0" : "1"}">
            ${profile.status === "active" ? "下线" : "上线"}
          </button>
          <button class="ghost-button admin-reset" data-id="${profile.id}">重置次数</button>
        </div>
      </article>
    `).join("");

    listNode.querySelectorAll(".admin-toggle").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const data = await adminRequest(`/api/admin/profiles/${button.dataset.id}/toggle`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: button.dataset.active === "1" })
          });
          replaceAdminProfile(profiles, data);
          renderList();
        } catch (error) {
          window.alert(error.message);
          button.disabled = false;
        }
      });
    });

    listNode.querySelectorAll(".admin-reset").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const data = await adminRequest(`/api/admin/profiles/${button.dataset.id}/reset-quotas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ matchCount: 3, chatCount: 10 })
          });
          replaceAdminProfile(profiles, data);
          renderList();
        } catch (error) {
          window.alert(error.message);
          button.disabled = false;
        }
      });
    });
  };

  filterNode.addEventListener("change", renderList);
  document.querySelector("#admin-logout")?.addEventListener("click", async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    window.location.href = "/admin";
  });
  renderList();
}

function renderPublic(profile) {
  const meta = typeMeta[profile.type];
  const sections = profile.generated.sections.map((section) => `
    <section class="content-card">
      <div class="section-title">${escapeHtml(section.title)}</div>
      <ul class="bullet-list">
        ${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>
  `).join("");

  app.innerHTML = `
    <main class="shell shell-public theme-${profile.type}">
      <section class="profile-banner">
        <div class="profile-main">
          <div>
            <p class="profile-badge">${profile.theme.label}</p>
            <h1>${escapeHtml(profile.title)}</h1>
            <p class="hero-line">${escapeHtml(profile.generated.heroLine)}</p>
            <p class="profile-summary">${escapeHtml(profile.generated.summary)}</p>
          </div>
          ${profile.photoDataUrl ? `<img class="hero-photo" src="${profile.photoDataUrl}" alt="${escapeHtml(profile.name)}" />` : `<div class="hero-photo placeholder">${escapeHtml((profile.name || "图").slice(0, 1))}</div>`}
        </div>
        <div class="tag-row">
          ${profile.generated.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="quota-strip">
          <span>匹配剩余 ${profile.usage.matchRemaining} / 3</span>
          <span>聊天剩余 ${profile.usage.chatRemaining} / 10</span>
          <span>${profile.status === "active" ? "当前在线" : "当前下线"}</span>
        </div>
        ${profile.status !== "active" ? `<div class="status-banner">页面已下线，只保留查看，不允许继续匹配和聊天。</div>` : ""}
      </section>

      <section class="public-grid">
        <div class="main-stack">
          ${sections}
        </div>
        <aside class="side-stack">
          <section class="content-card">
            <div class="section-title">${meta.matchTitle}</div>
            <p class="hint">${meta.matchHint}</p>
            <form id="match-form">
              <textarea name="message" rows="8" ${isMatchDisabled(profile) ? "disabled" : ""} placeholder="${matchPlaceholder(profile.type)}"></textarea>
              <button class="primary-button" type="submit" ${isMatchDisabled(profile) ? "disabled" : ""}>开始匹配分析</button>
            </form>
            <p class="hint">${matchStatusText(profile)}</p>
            <div id="match-result" class="stack-box"></div>
          </section>

          <section class="content-card">
            <div class="section-title">${meta.chatTitle}</div>
            <p class="hint">${meta.chatHint}</p>
            <div class="chat-prompt-list">
              ${(profile.generated.chatPrompts || []).map((prompt) => `<span>${escapeHtml(prompt)}</span>`).join("")}
            </div>
            <a class="primary-button button-link ${isChatDisabled(profile) ? "is-disabled" : ""}" href="${isChatDisabled(profile) ? "#" : profile.links.chatUrl}">${meta.chatAction}</a>
            <p class="hint">${chatStatusText(profile)}</p>
          </section>
        </aside>
      </section>
    </main>
  `;

  wireInteractiveForm(`/api/profiles/${profile.id}/match`, "#match-form", "#match-result", renderMatchResult);
}

function renderChat(profile) {
  const meta = typeMeta[profile.type];
  const logs = Array.isArray(profile.publicLogs?.chat) ? profile.publicLogs.chat : [];

  app.innerHTML = `
    <main class="shell shell-chat theme-${profile.type}">
      <section class="chat-page-head">
        <div>
          <p class="eyebrow">${escapeHtml(profile.theme.label)}</p>
          <h1>${meta.chatTitle}</h1>
          <p class="hero-copy">${meta.chatHint}</p>
        </div>
        <div class="chat-head-actions">
          <a class="ghost-button button-link" href="${profile.links.publicUrl}">返回资料页</a>
          <span class="quota-chip">剩余 ${profile.usage.chatRemaining} / 10</span>
        </div>
      </section>

      <section class="chat-layout">
        <aside class="chat-sidebar">
          <div class="content-card">
            <div class="section-title">资料摘要</div>
            <h2>${escapeHtml(profile.title)}</h2>
            <p class="hint">${escapeHtml(profile.generated.summary)}</p>
            <div class="chat-prompt-list">
              ${(profile.generated.chatPrompts || []).map((prompt) => `<button class="ghost-button chat-prompt-btn" data-value="${escapeHtml(prompt)}" ${isChatDisabled(profile) ? "disabled" : ""}>${escapeHtml(prompt)}</button>`).join("")}
            </div>
          </div>
        </aside>

        <section class="chat-panel">
          <div class="chat-history" id="chat-history">
            ${renderChatHistory(logs, profile)}
          </div>
          <form id="chat-form" class="chat-compose">
            <textarea name="message" rows="3" ${isChatDisabled(profile) ? "disabled" : ""} placeholder="${chatPlaceholder(profile.type)}"></textarea>
            <button class="primary-button" type="submit" ${isChatDisabled(profile) ? "disabled" : ""}>发送</button>
          </form>
          <p class="hint">${chatStatusText(profile)}</p>
        </section>
      </section>
    </main>
  `;

  document.querySelectorAll(".chat-prompt-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const textarea = document.querySelector("#chat-form textarea");
      if (!textarea || textarea.disabled) return;
      textarea.value = button.dataset.value;
      textarea.focus();
    });
  });

  wireChatForm(`/api/profiles/${profile.id}/chat`, profile);
}

function renderManage(profile) {
  app.innerHTML = `
    <main class="shell shell-manage">
      <section class="hero-home compact">
        <div class="hero-copy-wrap">
          <p class="eyebrow">Manage</p>
          <h1>${escapeHtml(profile.title)}</h1>
          <p class="hero-copy">你可以修改图片、重写资料、重新生成内容、上下线页面，并重置分析和聊天次数。</p>
        </div>
        <div class="hero-badges">
          <span>状态：${profile.status === "active" ? "在线" : "下线"}</span>
          <span>匹配剩余：${profile.usage.matchRemaining}</span>
          <span>聊天剩余：${profile.usage.chatRemaining}</span>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Links</p>
            <h2>页面链接</h2>
          </div>
        </div>
        <div class="result-box">
          <p>公开链接</p>
          <a href="${profile.links.publicUrl}" target="_blank" rel="noreferrer">${profile.links.publicUrl}</a>
          <p>聊天链接</p>
          <a href="${profile.links.chatUrl}" target="_blank" rel="noreferrer">${profile.links.chatUrl}</a>
          <p>管理链接</p>
          <a href="${profile.links.manageUrl}" target="_blank" rel="noreferrer">${profile.links.manageUrl}</a>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Edit</p>
            <h2>资料编辑</h2>
          </div>
          <p>不同类型会生成不同版式和不同语气。</p>
        </div>
        <form id="manage-form" class="form-grid">
          <label>
            <span>资料类型</span>
            <select name="type">
              ${Object.entries(profileTypes).map(([key, item]) => `<option value="${key}" ${profile.type === key ? "selected" : ""}>${item.label}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>姓名或称呼</span>
            <input name="name" value="${escapeHtml(profile.name)}" />
          </label>
          <label>
            <span>页面标题</span>
            <input name="title" value="${escapeHtml(profile.title)}" />
          </label>
          <label>
            <span>强调重点</span>
            <input name="focus" value="${escapeHtml(profile.focus || "")}" />
          </label>
          <label class="full-span">
            <span>当前图片</span>
            ${profile.photoDataUrl ? `<img class="photo-preview" src="${profile.photoDataUrl}" alt="当前图片" />` : `<p class="hint">当前未上传图片</p>`}
          </label>
          <label class="full-span">
            <span>更换图片</span>
            <input id="manage-photo-input" type="file" accept="image/*" />
            <div class="toggle-row">
              <input id="clear-photo" type="checkbox" />
              <p class="hint">勾选后会删除当前图片。</p>
            </div>
            <img id="manage-photo-preview" class="photo-preview is-hidden" alt="新图片预览" />
          </label>
          <label class="full-span">
            <span>原始输入</span>
            <textarea name="rawInput" rows="12">${escapeHtml(profile.rawInput || "")}</textarea>
          </label>
          <label class="checkbox-line full-span">
            <input type="checkbox" name="resetCounts" />
            <span>重新生成时顺便重置匹配和聊天次数</span>
          </label>
          <button class="primary-button" type="submit">保存并重新生成</button>
        </form>
        <div id="manage-result" class="result-box is-hidden"></div>
      </section>

      <section class="control-row">
        <button id="toggle-status" class="ghost-button">${profile.status === "active" ? "立即下线" : "重新上线"}</button>
        <button id="reset-usage" class="ghost-button">恢复默认次数</button>
        <button id="create-share" class="ghost-button">生成访客专属链接</button>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Shares</p>
            <h2>访客专属链接</h2>
          </div>
          <p>不同人用不同链接，聊天记录和次数各自独立。</p>
        </div>
        <div id="share-result" class="result-box is-hidden"></div>
        <div class="log-list">
          ${(profile.shares || []).length ? profile.shares.map((share) => `
            <article class="log-item">
              <p><strong>${escapeHtml(share.label)}</strong></p>
              <p class="hint">匹配剩余 ${share.usage.matchRemaining} / 3，聊天剩余 ${share.usage.chatRemaining} / 10</p>
              <a href="${config.publicBaseUrl}/p/${profile.id}?share=${share.token}" target="_blank" rel="noreferrer">${config.publicBaseUrl}/p/${profile.id}?share=${share.token}</a>
            </article>
          `).join("") : `<p class="hint">还没有生成访客专属链接。</p>`}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Logs</p>
            <h2>最近互动</h2>
          </div>
        </div>
        <div class="log-grid">
          <div class="content-card">
            <div class="section-title">匹配记录</div>
            ${renderLogs(profile.logs?.match, "还没有人发起匹配分析。")}
          </div>
          <div class="content-card">
            <div class="section-title">聊天记录</div>
            ${renderLogs(profile.logs?.chat, "还没有人开始聊天。")}
          </div>
        </div>
      </section>
    </main>
  `;

  const token = profile.editToken;
  const form = document.querySelector("#manage-form");
  const result = document.querySelector("#manage-result");
  const shareResult = document.querySelector("#share-result");
  const photoInput = document.querySelector("#manage-photo-input");
  const photoPreview = document.querySelector("#manage-photo-preview");
  const clearPhoto = document.querySelector("#clear-photo");
  let nextPhotoDataUrl = "";

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    nextPhotoDataUrl = await fileToDataUrl(file);
    photoPreview.src = nextPhotoDataUrl;
    photoPreview.classList.remove("is-hidden");
    clearPhoto.checked = false;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setPending(form, true, "保存中...");
    const body = Object.fromEntries(new FormData(form).entries());
    body.token = token;
    body.resetCounts = body.resetCounts === "on";
    body.photoDataUrl = clearPhoto.checked ? "" : (nextPhotoDataUrl || profile.photoDataUrl || "");

    try {
      const response = await fetch(`/api/profiles/${profile.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      result.classList.remove("is-hidden");
      result.innerHTML = `<p>资料已更新，正在刷新。</p>`;
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      result.classList.remove("is-hidden");
      result.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    } finally {
      setPending(form, false, "保存并重新生成");
    }
  });

  document.querySelector("#toggle-status").addEventListener("click", async () => {
    const response = await fetch(`/api/profiles/${profile.id}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, active: profile.status !== "active" })
    });
    const data = await response.json();
    if (!response.ok) return alert(data.error || "操作失败");
    window.location.reload();
  });

  document.querySelector("#reset-usage").addEventListener("click", async () => {
    const response = await fetch(`/api/profiles/${profile.id}/reset-quotas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, matchCount: 3, chatCount: 10 })
    });
    const data = await response.json();
    if (!response.ok) return alert(data.error || "恢复失败");
    window.location.reload();
  });

  document.querySelector("#create-share").addEventListener("click", async () => {
    const label = window.prompt("给这个访客链接起个名字，例如：A / 候选人1 / 小王");
    if (label === null) return;
    const response = await fetch(`/api/profiles/${profile.id}/shares`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, label })
    });
    const data = await response.json();
    if (!response.ok) return alert(data.error || "生成失败");
    shareResult.classList.remove("is-hidden");
    shareResult.innerHTML = `
      <p>已生成访客专属链接</p>
      <a href="${data.shareUrl}" target="_blank" rel="noreferrer">${data.shareUrl}</a>
      <a href="${data.chatUrl}" target="_blank" rel="noreferrer">${data.chatUrl}</a>
    `;
    window.setTimeout(() => window.location.reload(), 1200);
  });
}

function wireInteractiveForm(url, formSelector, resultSelector, renderResult) {
  const form = document.querySelector(formSelector);
  if (!form) return;
  const result = document.querySelector(resultSelector);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setPending(form, true, "分析中...");
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          shareToken: payload?.activeShare?.token || ""
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "请求失败");
      result.innerHTML = renderResult(data);
      form.reset();
      refreshQuotaStrip(data.remaining);
    } catch (error) {
      result.innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`;
    } finally {
      setPending(form, false, "开始匹配分析");
    }
  });
}

function wireChatForm(url, profile) {
  const form = document.querySelector("#chat-form");
  const history = document.querySelector("#chat-history");
  if (!form || !history) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setPending(form, true, "发送中...");
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          shareToken: profile?.activeShare?.token || ""
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "发送失败");
      profile.publicLogs = profile.publicLogs || { chat: [] };
      profile.publicLogs.chat.push({
        at: new Date().toISOString(),
        input: body.message,
        result: data.result
      });
      profile.usage.chatRemaining = data.remaining;
      history.innerHTML = renderChatHistory(profile.publicLogs.chat, profile);
      document.querySelector(".quota-chip").textContent = `剩余 ${data.remaining} / 10`;
      form.reset();
    } catch (error) {
      alert(error.message);
    } finally {
      setPending(form, false, "发送");
    }
  });
}

function renderMatchResult(data) {
  const result = data.result;
  return `
    <div class="analysis-box">
      <p class="score-pill">匹配参考 ${escapeHtml(result.score)}</p>
      <h3>${escapeHtml(result.headline)}</h3>
      <div class="dimension-list">
        ${(result.dimensions || []).map((item) => `
          <article class="dimension-card">
            <div class="dimension-head">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(String(item.score || ""))}</span>
            </div>
            <p>${escapeHtml(item.summary || "")}</p>
          </article>
        `).join("")}
      </div>
      ${(result.bullets || []).length ? `<ul class="bullet-list">${result.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${result.warning ? `<p class="hint warn">${escapeHtml(result.warning)}</p>` : ""}
      <p class="hint">剩余次数：${data.remaining}</p>
    </div>
  `;
}

function renderChatHistory(logs, profile) {
  if (!logs.length) {
    return `
      <div class="empty-chat">
        <p>还没有聊天记录。</p>
        <p class="hint">${typeMeta[profile.type].chatHint}</p>
      </div>
    `;
  }

  return logs.map((item) => `
    <div class="chat-turn">
      <article class="chat-bubble visitor">
        <p class="chat-role">访客</p>
        <p>${escapeHtml(item.input || "")}</p>
      </article>
      <article class="chat-bubble ai">
        <p class="chat-role">${profile.type === "resume" ? "招聘助手" : "资料助手"}</p>
        <p>${escapeHtml(item.result?.reply || "")}</p>
        <p class="hint">${escapeHtml(item.result?.tone || "")}</p>
      </article>
    </div>
  `).join("");
}

function renderLogs(logs, emptyText) {
  if (!Array.isArray(logs) || logs.length === 0) return `<p class="hint">${emptyText}</p>`;
  return `
    <div class="log-list">
      ${logs.slice().reverse().slice(0, 6).map((item) => `
        <article class="log-item">
          <p class="log-time">${escapeHtml(formatTime(item.at))}</p>
          <p><strong>输入：</strong>${escapeHtml(item.input || "未填写")}</p>
          <p><strong>结果：</strong>${escapeHtml(extractLogText(item.result))}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function syncTypeCopy(type) {
  const help = document.querySelector("#type-help");
  const title = document.querySelector("#title-input");
  const focus = document.querySelector("#focus-input");
  if (!help || !title || !focus) return;
  help.innerHTML = `
    <div class="type-help-card">
      <strong>${typeHeadline(type)}</strong>
      <p>${typeMeta[type].intro}</p>
      <p class="hint">${typeMeta[type].matchHint}</p>
    </div>
  `;
  const defaults = {
    resume: { title: "求职简历页", focus: "岗位匹配、项目成果" },
    matchmaking: { title: "相亲交友资料", focus: "真诚稳定、自然相处" }
  };
  title.placeholder = defaults[type].title;
  focus.placeholder = defaults[type].focus;
}

function renderTemplates(type, container, textarea) {
  if (!container || !textarea) return;
  const items = typeMeta[type].examples || [];
  container.innerHTML = items.map((item, index) => `<button type="button" class="ghost-button template-btn" data-index="${index}">示例 ${index + 1}</button>`).join("");
  container.querySelectorAll(".template-btn").forEach((button) => {
    button.addEventListener("click", () => {
      textarea.value = items[Number(button.dataset.index)] || "";
      textarea.focus();
    });
  });
}

function typeHeadline(type) {
  return {
    resume: "面向招聘的职业页",
    matchmaking: "面向相亲和交友的关系页"
  }[type];
}

function matchPlaceholder(type) {
  return {
    resume: "请输入你的招聘需求、岗位 JD，或你想重点比较的工作能力维度。",
    matchmaking: "请输入你的资料，系统会结合当前资料做多维分析。"
  }[type];
}

function chatPlaceholder(type) {
  return {
    resume: "例如：可以详细说一下最近一个项目中你负责的部分吗？",
    matchmaking: "例如：你平时周末更喜欢安静一点还是出去活动？"
  }[type];
}

function isMatchDisabled(profile) {
  return profile.status !== "active" || profile.usage.matchRemaining <= 0;
}

function isChatDisabled(profile) {
  return profile.status !== "active" || profile.usage.chatRemaining <= 0;
}

function matchStatusText(profile) {
  if (profile.status !== "active") return "页面已下线，当前不能继续匹配。";
  if (profile.usage.matchRemaining <= 0) return "匹配次数已经用完，等待发布者重置。";
  return profile.type === "resume"
    ? "输入你的招聘需求后，系统会结合当前资料给出岗位匹配分析。"
    : "输入你的资料后，系统会结合当前资料给出多维关系分析。";
}

function chatStatusText(profile) {
  if (profile.status !== "active") return "页面已下线，聊天入口关闭。";
  if (profile.usage.chatRemaining <= 0) return "聊天次数已用完，等待发布者恢复。";
  return "点击按钮进入独立聊天页，可回看完整聊天历史。";
}

function refreshQuotaStrip(remaining) {
  const strip = document.querySelector(".quota-strip");
  if (!strip) return;
  const children = [...strip.children];
  if (children[0]) children[0].textContent = `匹配剩余 ${remaining} / 3`;
}

function setPending(form, pending, label) {
  const button = form.querySelector("button[type='submit']");
  if (!button) return;
  button.disabled = pending;
  button.textContent = label;
}

function formatTime(value) {
  if (!value) return "未知时间";
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(value) {
  if (!value) return "未知";
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function extractLogText(result) {
  if (!result) return "无";
  return result.reply || result.headline || JSON.stringify(result);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ensureLoadingOverlay() {
  if (document.querySelector("#global-loading")) return;
  const node = document.createElement("div");
  node.id = "global-loading";
  node.className = "global-loading is-hidden";
  node.innerHTML = `
    <div class="loading-card">
      <div class="spinner"></div>
      <h3 id="loading-title">处理中</h3>
      <p id="loading-text">请稍等…</p>
    </div>
  `;
  document.body.appendChild(node);
}

function showLoading(title, text) {
  const node = document.querySelector("#global-loading");
  if (!node) return;
  node.classList.remove("is-hidden");
  document.querySelector("#loading-title").textContent = title;
  document.querySelector("#loading-text").textContent = text;
}

function hideLoading() {
  const node = document.querySelector("#global-loading");
  if (!node) return;
  node.classList.add("is-hidden");
}

async function adminRequest(url, options = {}) {
  const response = await fetch(withAdminToken(url), options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "后台请求失败");
  return data;
}

function withAdminToken(url) {
  const adminToken = new URLSearchParams(window.location.search).get("token");
  if (!adminToken) return url;
  const target = new URL(url, window.location.origin);
  target.searchParams.set("token", adminToken);
  return `${target.pathname}${target.search}`;
}

function matchesAdminFilter(profile, value) {
  if (value === "all") return true;
  if (value === "active") return profile.status === "active";
  if (value === "inactive") return profile.status !== "active";
  return profile.type === value;
}

function replaceAdminProfile(list, nextProfile) {
  const index = list.findIndex((item) => item.id === nextProfile.id);
  if (index === -1) return;
  list[index] = nextProfile;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
