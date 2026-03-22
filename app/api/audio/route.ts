import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const roomId = formData.get("roomId") as string;

  if (!file || !roomId) {
    return NextResponse.json({ error: "file and roomId required" }, { status: 400 });
  }

  // 10MB limit
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }

  const sb = getServiceSupabase();
  const fileName = `${roomId}/${Date.now()}.webm`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await sb.storage
    .from("audio")
    .upload(fileName, buffer, { contentType: file.type || "audio/webm" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = sb.storage.from("audio").getPublicUrl(fileName);
  return NextResponse.json({ url: urlData.publicUrl });
}
