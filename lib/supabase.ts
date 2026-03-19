import { createClient } from "@supabase/supabase-js";

// Client-side (anon key, read-only via RLS)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

// Server-side (service role, full access)
export function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_KEY || ""
  );
}

export interface AvatarRow {
  id: string;
  name: string;
  avatar_url: string;
  route: string;
  access_token: string;
  created_at: string;
  updated_at: string;
}
