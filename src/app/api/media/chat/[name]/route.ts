import { NextRequest } from "next/server";
import { readFile, stat, unlink } from "fs/promises";
import path from "path";
import { errorResponse } from "@/lib/utils";
import { CHAT_UPLOAD_DIR, UPLOAD_TTL_MS } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Yüklenen chat resimlerini diskten sunar.
 * Next.js production'da `public/`'e RUNTIME'da yazılan dosyaları güvenilir
 * sunmadığı için resimler bu route üzerinden (node app'ten) stream edilir.
 * Herkese açık (widget ziyaretçileri de görebilmeli) — middleware'de public.
 */
const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  // Sadece bizim ürettiğimiz ad kalıbı: <uuid>.<ext> — path traversal / rastgele dosya okuma engeli
  const m = /^([a-f0-9-]{8,})\.(png|jpg|gif|webp)$/i.exec(name);
  if (!m) return errorResponse("Not found", 404);

  const filePath = path.join(CHAT_UPLOAD_DIR, name);
  if (!filePath.startsWith(CHAT_UPLOAD_DIR + path.sep)) return errorResponse("Not found", 404);

  try {
    // 24 saatlik ömür: süresi dolmuşsa sunma (ve diskten kaldır)
    const s = await stat(filePath);
    if (Date.now() - s.mtimeMs > UPLOAD_TTL_MS) {
      void unlink(filePath).catch(() => {});
      return errorResponse("Expired", 410);
    }
    const buf = await readFile(filePath);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[m[2].toLowerCase()] || "application/octet-stream",
        "Content-Length": String(buf.length),
        // Ömür 24 saat → tarayıcı bu süreden fazla önbelleklemesin
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return errorResponse("Not found", 404);
  }
}
