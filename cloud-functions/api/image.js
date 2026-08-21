import COS from "cos-nodejs-sdk-v5";
import { required, supabaseSelect } from "../_shared.js";

export async function onRequestGet(context) {
  try {
    const id = new URL(context.request.url).searchParams.get("id");
    if (!id) return new Response("Missing image id", { status: 400 });
    const rows = await supabaseSelect(
      context.env,
      `pages?select=image_key&id=eq.${encodeURIComponent(id)}&limit=1`,
    );
    if (!rows.length) return new Response("Image not found", { status: 404 });

    const cos = new COS({
      SecretId: required(context.env, "COS_SECRET_ID"),
      SecretKey: required(context.env, "COS_SECRET_KEY"),
    });
    const signedUrl = cos.getObjectUrl({
      Bucket: required(context.env, "COS_BUCKET"),
      Region: required(context.env, "COS_REGION"),
      Key: rows[0].image_key,
      Sign: true,
      Expires: 300,
    });
    return Response.redirect(signedUrl, 302);
  } catch (error) {
    console.error("image failed", error);
    return new Response("Image service unavailable", { status: 500 });
  }
}
