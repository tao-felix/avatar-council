// SecondMe API wrapper
const API_BASE = "https://api.mindverse.com/gate/lab";

export function getSecondMeAuthUrl(clientId: string, redirectUri: string) {
  const state = Math.random().toString(36).substring(2, 15);
  return `https://go.second.me/oauth/?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`;
}

export async function exchangeCodeForToken(code: string, clientId: string, clientSecret: string, redirectUri: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(`${API_BASE}/api/oauth/token/code`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
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
