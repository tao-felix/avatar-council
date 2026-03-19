import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getUserInfo } from "@/lib/secondme";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", req.url));
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/auth/callback`;
    const tokenData = await exchangeCodeForToken(
      code,
      process.env.SECONDME_CLIENT_ID!,
      process.env.SECONDME_CLIENT_SECRET!,
      redirectUri
    );

    if (!tokenData.data?.accessToken && !tokenData.access_token) {
      return NextResponse.redirect(new URL("/?error=token_failed", req.url));
    }

    const accessToken = tokenData.data?.accessToken || tokenData.access_token;
    const userInfo = await getUserInfo(accessToken);
    const user = userInfo.data || {};

    // Save avatar to Supabase (upsert by name+route)
    const sb = getServiceSupabase();
    await sb.from("avatars").upsert(
      {
        name: user.name || "User",
        avatar_url: user.avatarUrl || user.avatar || "",
        route: user.route || "",
        access_token: accessToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "name,route" }
    );

    // Set cookies for current session
    const response = NextResponse.redirect(new URL("/", req.url));
    response.cookies.set("sm_token", accessToken, { httpOnly: false, maxAge: 86400 });
    response.cookies.set(
      "sm_user",
      JSON.stringify({
        name: user.name || "User",
        avatar: user.avatarUrl || user.avatar || "",
        route: user.route || "",
      }),
      { httpOnly: false, maxAge: 86400 }
    );
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?error=auth_failed", req.url));
  }
}
