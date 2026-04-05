# Claw 使用口令文档

这份文档汇总 `profile-share-assistant` 的推荐口令，面向“创建资料页 + 用管理链接操作”的日常场景。

---

## 1. 使用前提

- 服务可访问（本地 `http://127.0.0.1:8787` 或 Render 线上地址）
- Claw 能命中 `profile-share-assistant`

线上建议统一使用 Render 固定域名：

- `https://<service-name>.onrender.com`

---

## 2. 最推荐说法

- `skill 简历项目 帮我生成一个简历页，信息如下：...`
- `skill 简历项目 帮我生成一个相亲交友资料页，信息如下：...`
- `skill 简历项目 根据这个管理链接把页面下线：...`
- `skill 简历项目 根据这个管理链接重置次数：...`
- `skill 简历项目 根据这个管理链接重新生成资料：...`

也支持不带 `skill` 前缀的自然说法：

- `帮我生成一个简历页，信息如下：...`
- `帮我生成一个相亲交友资料页，信息如下：...`
- `根据这个管理链接把页面下线：...`

---

## 3. 当前支持能力

- 创建简历页
- 创建相亲交友页
- 返回公开链接
- 返回管理链接
- 下线/上线页面
- 重置匹配和聊天次数
- 重新生成页面内容

---

## 4. 管理最佳实践

最稳做法是直接提供管理链接，因为它包含：

- 页面 id
- 管理 token

推荐说法：

- `根据这个管理链接把页面下线：...`
- `根据这个管理链接重置次数：...`
- `根据这个管理链接重新生成：...`

---

## 5. 关键文件

- [CLAW_USAGE.md](./CLAW_USAGE.md)
- [SKILL.md](./skills/profile-share-assistant/SKILL.md)
- [publish_profile.js](./skills/profile-share-assistant/scripts/publish_profile.js)
- [manage_profile.js](./skills/profile-share-assistant/scripts/manage_profile.js)
