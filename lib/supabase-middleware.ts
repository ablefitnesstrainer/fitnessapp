import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

const allowPublicSignup = process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP === "true";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          supabaseResponse.cookies.set(name, value, options);
        });
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicAuthPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth/callback");

  if (!allowPublicSignup && pathname.startsWith("/register")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (!user && !isPublicAuthPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  const isLoginOrRegister = pathname.startsWith("/login") || pathname.startsWith("/register");
  if (user && isLoginOrRegister) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  const isPageRequest = !pathname.startsWith("/api") && !isPublicAuthPath;
  if (user && isPageRequest) {
    const { data: appUser } = await supabase.from("app_users").select("id,role").eq("id", user.id).maybeSingle();

    if (appUser?.role === "client") {
      const { data: clientRow } = await supabase.from("clients").select("id").eq("user_id", user.id).maybeSingle();
      if (clientRow?.id) {
        const { data: intakeRow } = await supabase.from("client_intakes").select("id").eq("client_id", clientRow.id).maybeSingle();
        const intakeCompleted = Boolean(intakeRow?.id);

        if (!intakeCompleted && !pathname.startsWith("/checkins")) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = "/checkins";
          redirectUrl.searchParams.set("required", "intake");
          return NextResponse.redirect(redirectUrl);
        }
      }
    }
  }

  return supabaseResponse;
}
