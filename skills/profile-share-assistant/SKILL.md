---
name: profile-share-assistant
description: Use when the user wants to create or manage a shareable resume page or matchmaking/social profile through the profile-share service, including returning public/manage URLs and managing existing pages by manage URL.
---

# Profile Share Assistant

This skill publishes profile pages through the `profile-share-hub` service.

Project path:

`.`

## When to use

- The user wants a shareable resume page
- The user wants a matchmaking/social introduction page
- The user wants public + manage URLs
- The user wants to activate/deactivate/reset/regenerate an existing page

## Good trigger phrases

- `skill 简历项目 帮我生成一个简历页`
- `skill 简历项目 帮我生成一个相亲交友资料页`
- `skill 简历项目 根据这个管理链接把页面下线`
- `skill 简历项目 根据这个管理链接重置次数`
- `帮我生成一个简历页`
- `根据这个管理链接重新生成资料`

## Workflow

1. Decide the page `type`:
   - `resume` for jobs/work history/projects
   - `matchmaking` for dating/introduction pages
2. Gather or infer:
   - `name`
   - `title`
   - `focus`
   - raw source text
3. Make sure the service is running:

```bash
cd .
npm start
```

4. Publish:

```bash
cd .
node skills/profile-share-assistant/scripts/publish_profile.js \
  --type resume \
  --name "张三" \
  --title "高级前端工程师简历卡" \
  --focus "前端架构与业务落地" \
  --text "将用户提供的原始信息完整放在这里"
```

5. Return:
   - public URL
   - manage URL

## Manage existing pages

If the user gives a manage URL, use it directly.

Activate:

```bash
cd .
node skills/profile-share-assistant/scripts/manage_profile.js \
  --manage-url "完整管理链接" \
  --action activate
```

Deactivate:

```bash
cd .
node skills/profile-share-assistant/scripts/manage_profile.js \
  --manage-url "完整管理链接" \
  --action deactivate
```

Reset usage:

```bash
cd .
node skills/profile-share-assistant/scripts/manage_profile.js \
  --manage-url "完整管理链接" \
  --action reset-usage \
  --match-count 3 \
  --chat-count 10
```

Regenerate:

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
