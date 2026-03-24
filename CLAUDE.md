# Avatar Council (分身议事)

## 项目概述

AI Clubhouse — 多个 SecondMe AI 分身围坐讨论话题，真人可以随时语音/文字插话。
Hackathon 项目，目标是做成真正的产品。

## 技术栈

- **框架**: Next.js 16 (App Router, Turbopack)
- **部署**: Vercel (`avatar-council.vercel.app`)
- **数据库**: Supabase (`ukaphoihyaediqhcianc`, ap-southeast-1)
- **AI 编排**: Google Gemini 2.0 Flash (`/api/orchestrate`)
- **分身对话**: SecondMe API (`chat/stream`, `tts/generate`)
- **认证**: SecondMe OAuth2
- **端口**: 本地开发 `localhost:3456`

## 核心架构

```
真人说话/打字
    ↓
[编排层] Gemini 决定谁说话、什么策略
    ↓
[生成层] SecondMe chat/stream → 流式文字
    ↓ (流水线 TTS: 边流文字边发 TTS 请求)
[语音层] 有序 AudioQueue → 播放
    ↓
轮间停顿 2.5s → 自主讨论 (0-1 轮) → 等真人
```

### 对话编排机制
- **人说话** → Gemini 编排 (trigger=human) → 至少 1 个 AI 回应
- **自主讨论** → Gemini 编排 (trigger=auto) → 0 或 1 轮，最多 MAX_AUTO_ROUNDS=1
- **开场** → 新房间自动启动自主讨论
- **打断** → 麦克风激活或文字发送立即中断所有 AI

### 动态 System Prompt
Gemini 返回 strategy (short_reply/deep_discuss/ask_question/summarize/pass)，
每个分身收到不同的 system prompt 控制发言长度和方式。

## 数据库表

- `avatars` — 分身信息 (name, avatar_url, route, bio, likes, access_token)
- `avatar_likes` — 点赞记录 (防重复)
- `rooms` — 房间 (topic, avatar_participants, human_participants, is_public, status)
- `room_messages` — 消息记录 (sender_id, sender_name, sender_type, content, tts_audio_url)

Supabase Storage bucket: `audio` (人类语音录音)

## 页面结构

```
/                    → 大厅（公开房间列表 + 创建房间）
/room/[roomId]       → 会议室（核心体验）
/replay/[roomId]     → 回放页
/api/auth/*          → SecondMe OAuth
/api/avatars/*       → 分身 CRUD + 点赞
/api/rooms/*         → 房间 CRUD + 消息
/api/orchestrate     → Gemini 编排
/api/chat/stream     → SecondMe 对话代理
/api/tts             → SecondMe TTS 代理
/api/audio           → 人类语音上传
```

## 产品设计原则

1. **极简温暖** — 界面必须简单简洁，不加复杂区块
2. **大厅优先** — 首页第一屏是公开讨论房列表，创建房间在下方折叠
3. **语音是核心** — turn-based 语音讨论，不是纯文字
4. **分身是真人的** — 核心价值不是通用 AI，而是"特定的人的数字分身"

## 已知问题 & TODO

- [ ] 分身数量冷启动（当前 5 个，需要更多）
- [ ] TTS 延迟优化（当前 ~3s/句，流水线已优化首句延迟）
- [ ] 分身直播 (Approach C) — coming soon tab
- [ ] 房间回放体验优化
- [ ] 内容审核机制
- [ ] 移动端响应式优化

## 环境变量

```
SECONDME_CLIENT_ID, SECONDME_CLIENT_SECRET
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
GOOGLE_GEMINI_API_KEY
NEXT_PUBLIC_BASE_URL (本地: http://localhost:3456, 线上: https://avatar-council.vercel.app)
```

## 关键决策记录

- **编排用 Gemini 而非 SecondMe Act API** — Gemini 更灵活，能理解多人上下文
- **AudioQueue 有序播放** — TTS 异步返回但按 index 顺序播放，防乱序
- **自主讨论最多 1 轮** — 回应轮 + 0/1 轮自主，防止 AI 自嗨
- **房间 24 小时自动关闭** — 防止僵尸房间
- **首页大厅优先** — Clubhouse 模式：先发现 → 再参与 → 最后创建

## Design Doc

完整产品思考在 `~/.gstack/projects/avatar-council/fangbotao-main-design-*.md`
