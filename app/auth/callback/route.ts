import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const next = requestUrl.searchParams.get("next");

  if (code || (tokenHash && type)) {
    const supabase = createClient();
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
    } else if (tokenHash && type) {
      await supabase.auth.verifyOtp({
        type: type as EmailOtpType,
        token_hash: tokenHash
      });
    }
  }

  const redirectPath = type === "recovery" ? "/reset-password" : next && next.startsWith("/") ? next : "/dashboard";
  const redirectUrl = new URL(redirectPath, requestUrl.origin);

  return NextResponse.redirect(redirectUrl);
}
