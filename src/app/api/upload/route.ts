import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { jsonResponse, errorResponse } from "@/lib/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "text/plain", "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const ALLOWED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
  ".pdf", ".txt", ".csv", ".doc", ".docx", ".xls", ".xlsx",
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return errorResponse("Dosya gereklidir", 400);
    }

    // Dosya boyutu kontrolü
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("Dosya boyutu en fazla 5MB olabilir", 400);
    }

    // MIME type kontrolü
    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse("Bu dosya türü desteklenmiyor", 400);
    }

    // Uzantı kontrolü
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return errorResponse("Bu dosya uzantısı desteklenmiyor", 400);
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Rastgele dosya adı oluştur (tahmin edilemez)
    const randomId = crypto.randomUUID();
    const safeName = `${randomId}${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");

    // Upload dizinini oluştur (yoksa)
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, safeName);

    // Path traversal kontrolü
    if (!filePath.startsWith(uploadDir)) {
      return errorResponse("Geçersiz dosya yolu", 400);
    }

    await writeFile(filePath, buffer);

    return jsonResponse({
      filename: file.name,
      url: `/uploads/${safeName}`,
    });
  } catch {
    return errorResponse("Dosya yükleme hatası", 500);
  }
}
