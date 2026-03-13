"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { EmailOtpType } from "@supabase/supabase-js";

function cleanNextPath(nextParam: string | null) {
  if (!nextParam || !nextParam.startsWith("/")) return "/dashboard";
  return nextParam;
}

function parseHashTokens(hash: string) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  return { accessToken, refreshToken };
}

export default function AuthFinishPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Completing sign-in...");

  useEffect(() => {
    let cancelled = false;

    async function finishAuth() {
      const supabase = createClient();
      const currentUrl = new URL(window.location.href);
      const code = currentUrl.searchParams.get("code");
      const tokenHash = currentUrl.searchParams.get("token_hash");
      const type = currentUrl.searchParams.get("type");
      const nextPath = cleanNextPath(currentUrl.searchParams.get("next"));
      const { accessToken, refreshToken } = parseHashTokens(window.location.hash);

      try {
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            type: type as EmailOtpType,
            token_hash: tokenHash
          });
          if (error) throw error;
        } else {
          throw new Error("Missing authentication token");
        }

        if (!cancelled) {
          setStatus("Sign-in complete. Redirecting...");
          router.replace(nextPath);
          router.refresh();
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to complete sign-in";
          setStatus(`Sign-in failed: ${message}`);
          setTimeout(() => {
            router.replace("/login");
          }, 1500);
        }
      }
    }

    finishAuth();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <section className="card mx-auto mt-8 max-w-md">
      <h1 className="text-xl font-semibold">Signing you in...</h1>
      <p className="mt-2 text-sm text-slate-600">{status}</p>
    </section>
  );
}
