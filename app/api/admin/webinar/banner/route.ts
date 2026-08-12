import { NextRequest, NextResponse } from "next/server";
import { appSupabase } from "@/lib/supabase";
import { getEmployee } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

const BUCKET = "webinar-banners";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * POST /api/admin/webinar/banner  (multipart: file, webinarId)
 * Uploads a banner image to the public `webinar-banners` bucket and returns its
 * public URL. Creates the bucket on first use so there's no manual setup.
 */
export async function POST(req: NextRequest) {
  if ((await getEmployee()).reason !== "ok") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  const webinarId = String(form.get("webinarId") ?? "").trim();
  if (!(file instanceof File) || !webinarId) {
    return NextResponse.json({ error: "file and webinarId required" }, { status: 400 });
  }
  if (!EXT[file.type]) {
    return NextResponse.json({ error: "must be a JPG, PNG, WEBP, or GIF image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "image must be under 8 MB" }, { status: 400 });
  }

  let sb;
  try {
    sb = appSupabase();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase not configured" },
      { status: 500 }
    );
  }

  // Ensure the bucket exists (idempotent — ignore "already exists").
  await sb.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  const path = `${webinarId}-${Date.now()}.${EXT[file.type]}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (error) {
    return NextResponse.json({ error: `upload failed: ${error.message}` }, { status: 500 });
  }

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
