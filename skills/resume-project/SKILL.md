---
name: resume-project
description: 简历项目技能。Use when the user says things like `skill 简历项目 ...` to create or manage shareable resume pages or 相亲交友资料页, including returning public/manage URLs and recovering the fixed share entry.
---

# Resume Project

This skill publishes structured profile pages through the local `profile-share-hub` service in the current project folder.

Project path:

`.`

## When to use

- The user wants a shareable resume page
- The user wants a matchmaking profile or dating card
- The user wants a social introduction page
- The user wants the page URL returned for WeChat or other chat channels
- The user wants to pause, reopen, reset usage, or regenerate an existing page from WeChat
- The user wants to recover all profile links after the temporary tunnel becomes invalid

## Good trigger phrases

Use a three-layer command shape when possible:

- `skill`
- `简历项目`
- `具体动作`

Canonical format:

- `skill 简历项目 帮我生成一个简历页`
- `skill 简历项目 帮我生成一个相亲交友资料页`
- `skill 简历项目 根据这个管理链接把页面下线`
- `skill 简历项目 恢复分享链接`

- skill 简历项目 帮我生成一个简历页
- skill 简历项目 帮我生成一个相亲交友资料页
- skill 简历项目 根据这个管理链接把页面下线
- skill 简历项目 根据这个管理链接重置次数
- skill 简历项目 恢复分享链接
- skill 简历项目 重新恢复固定入口
- skill 简历项目 让所有页面重新可以访问
- 帮我生成一个简历页
- 帮我生成一个相亲资料页
- 帮我生成一个相亲交友资料页
- 把这些信息做成分享链接
- 帮我把这个资料页下线
- 帮我重新上线这个页面
- 帮我重置这个页面的聊天次数
- 根据这个管理链接重新生成资料
- 恢复分享链接
- 重新恢复固定入口
- 让所有页面重新可以访问
- 恢复 profile-share 的链接
- 恢复 zqgogo 的分享链接
- 恢复资料页访问

## Workflow

1. If the user wants to recover the fixed entry after tunnel failure, do not ask what link type or platform it is. By default, assume the user means the fixed entry for this project:

`https://profile-share.zqgogo.workers.dev`

Project alias for intent matching:

- `skill 简历项目`
- `简历项目`
- `profile-share-hub`
- `profile share hub`
- `资料页项目`

Run:

```bash
cd .
node skills/profile-share-assistant/scripts/restore_fixed_entry.js
```

Return:

- the fixed workers.dev URL
- the new temporary tunnel upstream URL
- a short note that old shared links should work again through the fixed entry

If the user uses phrases like:

- `skill 简历项目 恢复分享链接`
- `skill 简历项目 重新恢复固定入口`
- `skill 简历项目 让所有页面重新可以访问`
- `恢复 profile-share-hub 的分享链接`
- `恢复 profile-share-hub`
- `恢复分享链接`
- `恢复 profile-share 的链接`
- `恢复 zqgogo 的分享链接`
- `让所有页面重新可以访问`

then treat it as the restore action above directly, without asking for extra context.

If the user uses phrases like:

- `skill 简历项目 帮我生成一个简历页`
- `skill 简历项目 帮我生成一个相亲交友资料页`
- `skill 简历项目 根据这个管理链接把页面下线`
- `skill 简历项目 根据这个管理链接重置次数`
- `帮我操作 profile-share-hub 这个资料页项目`

then treat it as this skill directly, without asking whether it is WeChat or another platform.

2. Otherwise decide the page `type`:
   - `resume` for jobs, work history, skills, projects
   - `matchmaking` for dating, introductions, or social relationship pages
3. Gather or infer:
   - `name`
   - `title`
   - `focus`
   - raw source text
4. Make sure the local service is running. If needed:

```bash
cd .
npm start
```

5. Run the publisher script:

```bash
cd .
node skills/profile-share-assistant/scripts/publish_profile.js \
  --type resume \
  --name "张三" \
  --title "高级前端工程师简历卡" \
  --focus "前端架构与业务落地" \
  --text "将用户提供的原始信息完整放在这里"
```

6. Return:
   - the public URL
   - the manage URL
   - a short note that the page supports 3 matching analyses and 10 chat turns by default

## Manage existing pages

If the user gives a manage URL, use it directly instead of asking for separate id/token.

Activate a page:

```bash
cd .
node skills/profile-share-assistant/scripts/manage_profile.js \
  --manage-url "完整管理链接" \
  --action activate
```

Deactivate a page:

```bash
cd .
node skills/profile-share-assistant/scripts/manage_profile.js \
  --manage-url "完整管理链接" \
  --action deactivate
```

Reset usage counts:

```bash
cd .
node skills/profile-share-assistant/scripts/manage_profile.js \
  --manage-url "完整管理链接" \
  --action reset-usage \
  --match-count 3 \
  --chat-count 10
```

Regenerate content:

```bash
cd .
node skills/profile-share-assistant/scripts/manage_profile.js \
  --manage-url "完整管理链接" \
  --action regenerate \
  --type matchmaking \
  --name "阿宁" \
  --title "新的相亲交友资料页" \
  --focus "轻松真诚" \
  --text "新的原始资料" \
  --reset-counts true
```

## Important behavior

- If the user gives mixed information, choose the type that best matches the user's goal rather than mirroring every detail.
- For matchmaking pages, keep wording warm and credible instead of overly marketing-like.
- The public page may be paused later through the manage URL.
- The web app reuses the same AI model configuration from OpenClaw when `.env` is empty, so keep only one provider config.
- If the service is unreachable, explain that the local web service must be started first with `npm run dev` or `npm start`.
- For WeChat control, the safest handle is always the manage URL because it already includes the page id and private token.
- For fixed-entry recovery, the script depends on `CLOUDFLARE_API_TOKEN` and the existing `workers.dev` worker configuration in the project.
