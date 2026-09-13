import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/domain";
import { redirectOrigin } from "@/lib/redirect-origin";
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = redirectOrigin(
    request.headers.get("host"),
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000",
  );
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const { error } = await (
      await serverClient()
    ).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL("/sign-in?error=confirmation", origin));
}
