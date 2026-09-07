import { NextRequest } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { errorResponse } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kart eklerini (public/uploads/...) diskten sunar.
 * Next.js production'da `public/`'e RUNTIME'da yazılan dosyaları güvenilir
 * sunmadığı için ekler bu route üzerinden (node app'ten) stream edilir.
 * `/uploads/<ad>` istekleri middleware'de buraya yönlendirilir (eski DB kayıtları da çalışır).
 * Kart ekleri KALICIDIR (chat resimlerinden farklı olarak 24 saat ömrü YOK).
 */
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// /api/upload'ın izin verdiği türler
const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  // Sadece /api/upload'ın ürettiği ad kalıbı: <uuid>.<ext> — path traversal / rastgele dosya okuma engeli
  const m = /^([a-f0-9-]{8,})\.([a-z0-9]+)$/i.exec(name);
  if (!m) return errorResponse("Not found", 404);
  const ext = m[2].toLowerCase();
  const mime = MIME[ext];
  if (!mime) return errorResponse("Not found", 404);

  const filePath = path.join(UPLOAD_DIR, name);
  if (!filePath.startsWith(UPLOAD_DIR + path.sep)) return errorResponse("Not found", 404);

  try {
    const s = await stat(filePath);
    if (!s.isFile()) return errorResponse("Not found", 404);
    const buf = await readFile(filePath);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        // SVG dahil tüm türlerde sniffing kapalı (XSS sertleştirme)
        "X-Content-Type-Options": "nosniff",
        // Tarayıcıda güvenli görüntüleme; belge türlerinde indirmeye düşer
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return errorResponse("Not found", 404);
  }
}
