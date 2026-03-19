import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getUserInfo } from "@/lib/secondme";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", req.url));
  }

  try {
    const tokenData = await exchangeCodeForToken(
      code,
      process.env.SECONDME_CLIENT_ID!,
      process.env.SECONDME_CLIENT_SECRET!
    );

    if (!tokenData.data?.accessToken && !tokenData.access_token) {
      return NextResponse.redirect(new URL("/?error=token_failed", req.url));
    }

    const accessToken = tokenData.data?.accessToken || tokenData.access_token;
    const userInfo = await getUserInfo(accessToken);
    const user = userInfo.data || {};

    // Set token and user info in cookies
    const response = NextResponse.redirect(new URL("/", req.url));
    response.cookies.set("sm_token", accessToken, { httpOnly: false, maxAge: 86400 });
    response.cookies.set(
      "sm_user",
      JSON.stringify({ name: user.name || "User", avatar: user.avatar || "" }),
      { httpOnly: false, maxAge: 86400 }
    );
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?error=auth_failed", req.url));
  }
}
