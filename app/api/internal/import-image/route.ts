import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const expected = env.IMPORT_TOKEN as string | undefined;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const key = request.headers.get("x-image-key") || "";
  if (!expected || supplied !== expected) return new Response("Unauthorized", { status: 401 });
  if (!key || key.includes("..")) return new Response("Invalid key", { status: 400 });
  await env.MEDIA.put(key, request.body, {
    httpMetadata: { contentType: request.headers.get("content-type") || "image/jpeg" },
  });
  return NextResponse.json({ ok: true, key });
}
