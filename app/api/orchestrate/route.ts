import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

interface OrchestrateRequest {
  topic: string;
  messages: { sender: string; text: string }[];
  avatars: { name: string; bio: string }[];
}

export async function POST(req: NextRequest) {
  const { topic, messages, avatars } = (await req.json()) as OrchestrateRequest;
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    // Fallback: all avatars respond with default strategy
    return NextResponse.json({
      responses: avatars.map((a) => ({
        avatar_name: a.name,
        strategy: "short_reply",
        max_sentences: 3,
      })),
    });
  }

  const recentContext = messages
    .slice(-15)
    .map((m) => `${m.sender}: ${m.text}`)
    .join("\n");

  const avatarList = avatars
    .map((a) => `- ${a.name}: ${a.bio || "（暂无简介）"}`)
    .join("\n");

  const prompt = `你是一个会议编排 AI。根据以下会议上下文，决定接下来哪些分身应该发言、以什么方式发言。

会议主题：${topic}

参会分身：
${avatarList}

最近对话：
${recentContext}

请返回 JSON（不要其他内容）：
{
  "responses": [
    {
      "avatar_name": "分身名字",
      "strategy": "short_reply",
      "max_sentences": 2
    }
  ]
}

strategy 可选值：
- short_reply: 1-2句，简短附和或评论
- deep_discuss: 3-5句，深入探讨
- ask_question: 1-2句，追问或引导新方向
- summarize: 2-3句，总结讨论
- pass: 不说话

规则：
- 如果用户明确提到了某个分身的名字（如"蛋总讲个笑话"、"Tao你觉得呢"），被点名的分身必须回应，且应该排在第一个
- 不是所有人都需要说话，可以 0 个人说
- 大部分时候 1-2 个人回应就够了
- 考虑每个分身的背景和性格，话题跟谁相关谁说
- 如果前面已经有分身说了类似的观点，后面的就不用重复
- 对话刚开始时可以多人参与，深入讨论后聚焦 1-2 人
- 不要让同一个人连续说太多轮`;

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    try {
      const parsed = JSON.parse(text);
      if (parsed.responses && Array.isArray(parsed.responses)) {
        return NextResponse.json(parsed);
      }
    } catch {
      // JSON parse failed
    }

    // Fallback
    return NextResponse.json({
      responses: avatars.map((a) => ({
        avatar_name: a.name,
        strategy: "short_reply",
        max_sentences: 3,
      })),
    });
  } catch {
    return NextResponse.json({
      responses: avatars.map((a) => ({
        avatar_name: a.name,
        strategy: "short_reply",
        max_sentences: 3,
      })),
    });
  }
}
