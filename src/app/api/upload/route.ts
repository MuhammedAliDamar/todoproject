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
      return errorResponse("File is required", 400);
    }

    // File size check
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("File size cannot exceed 5MB", 400);
    }

    // MIME type check
    if (!ALLOWED_TYPES.includes(file.type)) {
      return errorResponse("This file type is not supported", 400);
    }

    // Extension check
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return errorResponse("This file extension is not supported", 400);
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate random filename (unpredictable)
    const randomId = crypto.randomUUID();
    const safeName = `${randomId}${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");

    // Create upload directory if missing
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, safeName);

    // Path traversal check
    if (!filePath.startsWith(uploadDir)) {
      return errorResponse("Invalid file path", 400);
    }

    await writeFile(filePath, buffer);

    return jsonResponse({
      filename: file.name,
      url: `/uploads/${safeName}`,
    });
  } catch {
    return errorResponse("File upload error", 500);
  }
}
