// SecondMe API wrapper
const API_BASE = "https://api.mindverse.com/gate/lab";

export async function getSecondMeAuthUrl(clientId: string, redirectUri: string) {
  // SecondMe OAuth authorize URL
  return `https://second-me.cn/third-party/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=user.info+chat+voice`;
}

export async function exchangeCodeForToken(code: string, clientId: string, clientSecret: string) {
  const res = await fetch(`${API_BASE}/api/secondme/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  return res.json();
}

export async function getUserInfo(accessToken: string) {
  const res = await fetch(`${API_BASE}/api/secondme/user/info`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}

export async function chatStream(
  accessToken: string,
  message: string,
  sessionId?: string,
  systemPrompt?: string
): Promise<Response> {
  return fetch(`${API_BASE}/api/secondme/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message,
      sessionId,
      systemPrompt,
    }),
  });
}

export async function generateTTS(accessToken: string, text: string) {
  const res = await fetch(`${API_BASE}/api/secondme/tts/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ text }),
  });
  return res.json();
}
