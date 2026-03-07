import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next");

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const redirectPath = type === "recovery" ? "/reset-password" : next && next.startsWith("/") ? next : "/dashboard";
  const redirectUrl = new URL(redirectPath, requestUrl.origin);

  return NextResponse.redirect(redirectUrl);
}
