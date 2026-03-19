import { NextResponse } from "next/server";
import { getSecondMeAuthUrl } from "@/lib/secondme";

export async function GET() {
  const clientId = process.env.SECONDME_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/auth/callback`;
  const url = await getSecondMeAuthUrl(clientId, redirectUri);
  return NextResponse.redirect(url);
}
