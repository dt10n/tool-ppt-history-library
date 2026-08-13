import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function readUint32(view: DataView, offset: number) {
  if (offset + 4 > view.byteLength) throw new Error("truncated batch");
  return view.getUint32(offset, false);
}

export async function PUT(request: NextRequest) {
  const expected = env.IMPORT_TOKEN as string | undefined;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || supplied !== expected) return new Response("Unauthorized", { status: 401 });

  try {
    const payload = await request.arrayBuffer();
    if (payload.byteLength > 16 * 1024 * 1024) return new Response("Batch too large", { status: 413 });
    const view = new DataView(payload);
    const decoder = new TextDecoder();
    let offset = 0;
    const count = readUint32(view, offset);
    offset += 4;
    if (count < 1 || count > 24) return new Response("Invalid batch count", { status: 400 });
    const writes: Promise<unknown>[] = [];
    for (let index = 0; index < count; index += 1) {
      const keyLength = readUint32(view, offset); offset += 4;
      const key = decoder.decode(new Uint8Array(payload, offset, keyLength)); offset += keyLength;
      const typeLength = readUint32(view, offset); offset += 4;
      const contentType = decoder.decode(new Uint8Array(payload, offset, typeLength)); offset += typeLength;
      const dataLength = readUint32(view, offset); offset += 4;
      if (!key || key.includes("..") || offset + dataLength > payload.byteLength) throw new Error("invalid batch item");
      const body = payload.slice(offset, offset + dataLength); offset += dataLength;
      writes.push(env.MEDIA.put(key, body, { httpMetadata: { contentType: contentType || "image/jpeg" } }));
    }
    if (offset !== payload.byteLength) throw new Error("unexpected trailing data");
    await Promise.all(writes);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "invalid batch" }, { status: 400 });
  }
}
