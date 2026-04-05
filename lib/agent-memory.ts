import { createHash } from "crypto";

const API_URL =
  "https://api.mindverse.com/gate/lab/api/secondme/agent_memory/ingest";
const PLATFORM = "secondme_avatar_council";
const ORIGIN =
  process.env.NEXT_PUBLIC_BASE_URL || "https://avatar-council.vercel.app";

const Action = {
  ROOM_CREATED: "room_created",
  HUMAN_SPEECH: "human_speech",
  AVATAR_SPEECH: "avatar_speech",
  ROOM_ENDED: "room_ended",
} as const;

// ─── Types ───────────────────────────────────────────────────────

interface ChannelInfo {
  platform: string;
  kind: string;
  id?: string;
  url?: string;
}

interface RefItem {
  type: string;
  platform: string;
  objectType: string;
  objectId: string;
  url?: string;
  contentPreview?: string;
  snapshot?: { text: string; capturedAt: number };
}

interface IngestBody {
  channel: ChannelInfo;
  action: string;
  actionLabel?: string;
  displayText: string;
  refs: RefItem[];
  importance?: number;
  idempotencyKey?: string;
  payload?: Record<string, unknown>;
}

// ─── Helpers ─────────────────────────────────────────────────────

function idemKey(objectType: string, objectId: string): string {
  return createHash("sha256")
    .update(`external:${PLATFORM}:${objectType}:${objectId}`)
    .digest("hex");
}

function roomUrl(roomId: string): string {
  return `${ORIGIN}/replay/${roomId}`;
}

async function ingestAgentMemory(
  token: string,
  body: IngestBody
): Promise<void> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[agent-memory] ${body.action} failed ${res.status}: ${text}`);
    }
  } catch (err) {
    console.warn(`[agent-memory] ${body.action} error:`, (err as Error).message);
  }
}

// ─── Report functions ────────────────────────────────────────────

export async function reportRoomCreated(
  token: string,
  data: { roomId: string; topic: string; createdBy: string }
): Promise<void> {
  const url = roomUrl(data.roomId);
  await ingestAgentMemory(token, {
    channel: { platform: PLATFORM, kind: "room", id: "分身篝火会", url },
    action: Action.ROOM_CREATED,
    actionLabel: "创建房间",
    displayText: `真人在分身篝火会创建了房间「${data.topic}」`,
    refs: [
      {
        type: "external_action",
        platform: PLATFORM,
        objectType: "room",
        objectId: data.roomId,
        url,
        snapshot: { text: `房间主题：${data.topic}`, capturedAt: Date.now() },
      },
    ],
    importance: 1,
    idempotencyKey: idemKey("room_created", data.roomId),
    payload: { topic: data.topic, createdBy: data.createdBy },
  });
}

export async function reportHumanSpeech(
  token: string,
  data: {
    roomId: string;
    topic: string;
    messageId: string;
    senderName: string;
    content: string;
  }
): Promise<void> {
  const url = roomUrl(data.roomId);
  await ingestAgentMemory(token, {
    channel: { platform: PLATFORM, kind: "speech", id: "分身篝火会", url },
    action: Action.HUMAN_SPEECH,
    actionLabel: "发言",
    displayText: `真人在分身篝火会的房间「${data.topic}」中发言：${data.content.slice(0, 80)}`,
    refs: [
      {
        type: "external_action",
        platform: PLATFORM,
        objectType: "human_message",
        objectId: data.messageId,
        url,
        contentPreview: data.content.slice(0, 200),
        snapshot: { text: data.content, capturedAt: Date.now() },
      },
    ],
    importance: 1,
    idempotencyKey: idemKey("human_message", data.messageId),
    payload: { roomId: data.roomId, senderName: data.senderName },
  });
}

export async function reportAvatarSpeech(
  token: string,
  data: {
    roomId: string;
    topic: string;
    messageId: string;
    avatarName: string;
    content: string;
  }
): Promise<void> {
  const url = roomUrl(data.roomId);
  await ingestAgentMemory(token, {
    channel: { platform: PLATFORM, kind: "speech", id: "分身篝火会", url },
    action: Action.AVATAR_SPEECH,
    actionLabel: "分身发言",
    displayText: `你的分身在分身篝火会的房间「${data.topic}」中发言：${data.content.slice(0, 80)}`,
    refs: [
      {
        type: "external_action",
        platform: PLATFORM,
        objectType: "avatar_message",
        objectId: data.messageId,
        url,
        contentPreview: data.content.slice(0, 200),
        snapshot: { text: data.content, capturedAt: Date.now() },
      },
    ],
    importance: 0,
    idempotencyKey: idemKey("avatar_message", data.messageId),
    payload: { roomId: data.roomId, avatarName: data.avatarName },
  });
}

export async function reportRoomEnded(
  token: string,
  data: { roomId: string; topic: string; messageCount: number }
): Promise<void> {
  const url = roomUrl(data.roomId);
  await ingestAgentMemory(token, {
    channel: { platform: PLATFORM, kind: "room", id: "分身篝火会", url },
    action: Action.ROOM_ENDED,
    actionLabel: "结束房间",
    displayText: `分身篝火会的房间「${data.topic}」已结束，共 ${data.messageCount} 条消息`,
    refs: [
      {
        type: "external_action",
        platform: PLATFORM,
        objectType: "room",
        objectId: data.roomId,
        url,
        snapshot: {
          text: `房间「${data.topic}」结束，共 ${data.messageCount} 条消息`,
          capturedAt: Date.now(),
        },
      },
    ],
    importance: 1,
    idempotencyKey: idemKey("room_ended", data.roomId),
    payload: { topic: data.topic, messageCount: data.messageCount },
  });
}
