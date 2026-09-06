/**
 * Güvenli resim yükleme yardımcıları (chat ekleri).
 *
 * Neden ayrı: public /api/upload istemcinin verdiği `file.type` ve uzantıya güvenir
 * (spoof edilebilir) ve SVG/PDF gibi tehlikeli türlere izin verir. Chat eki HERKESE
 * AÇIK widget'tan gelebildiği için burada tür SADECE dosyanın gerçek imzasından
 * (magic bytes) belirlenir; SVG kabul edilmez (script gömülü XSS riski).
 */
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Tampon başındaki sihirli baytlardan resim türünü belirler.
 * Sadece raster resim: PNG / JPEG / GIF / WebP. Aksi halde null.
 * (İstemcinin bildirdiği MIME/uzantı asla dikkate alınmaz.)
 */
export function sniffImage(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return { ext: "png", mime: "image/png" };
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return { ext: "jpg", mime: "image/jpeg" };
  // GIF: "GIF8"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38)
    return { ext: "gif", mime: "image/gif" };
  // WebP: "RIFF"...."WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  )
    return { ext: "webp", mime: "image/webp" };
  return null;
}

/**
 * FormData'dan gelen dosyayı doğrular ve diske güvenli (rastgele) bir adla yazar.
 * Dönüş: { url, mime } ya da hata mesajı.
 */
export async function saveImageUpload(
  file: File
): Promise<{ url: string; mime: string } | { error: string }> {
  if (file.size > MAX_IMAGE_BYTES) return { error: "Image cannot exceed 5MB" };
  if (file.size === 0) return { error: "Empty file" };

  const buffer = Buffer.from(await file.arrayBuffer());
  // Boyut, arrayBuffer'dan da doğrulanır (Content-Length ile oynanmasına karşı)
  if (buffer.length > MAX_IMAGE_BYTES) return { error: "Image cannot exceed 5MB" };

  const kind = sniffImage(buffer);
  if (!kind) return { error: "Only image files (PNG, JPEG, GIF, WebP) are allowed" };

  const safeName = `${crypto.randomUUID()}.${kind.ext}`; // istemci adı hiç kullanılmaz
  const uploadDir = path.join(process.cwd(), "public", "uploads", "chat");
  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, safeName);
  // Path traversal güvencesi (safeName zaten UUID+sabit uzantı ama yine de kontrol)
  if (!filePath.startsWith(uploadDir + path.sep)) return { error: "Invalid path" };

  await writeFile(filePath, buffer);
  return { url: `/uploads/chat/${safeName}`, mime: kind.mime };
}
