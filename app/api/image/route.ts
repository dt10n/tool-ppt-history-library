import { env } from "cloudflare:workers";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return new Response("Missing image id", { status: 400 });
  const page = await env.DB.prepare("SELECT image_key FROM pages WHERE id=?").bind(id).first<{ image_key: string }>();
  if (!page) return new Response("Image not found", { status: 404 });
  const object = await env.MEDIA.get(page.image_key);
  if (!object) return new Response("Image migration pending", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=86400");
  return new Response(object.body, { headers });
}
