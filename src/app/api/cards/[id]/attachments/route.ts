import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse, verifyCardAccess } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(cardId, userId);
    if (!hasAccess) return errorResponse("Yetkiniz yok", 403);

    const { filename, url } = await req.json();

    if (!filename || !url) {
      return errorResponse("Dosya adı ve URL gereklidir", 400);
    }

    // URL'nin sadece yerel upload olmasını zorunlu kıl
    if (!url.startsWith("/uploads/")) {
      return errorResponse("Geçersiz dosya URL'si", 400);
    }

    const attachment = await prisma.attachment.create({
      data: { filename, url, cardId },
    });

    return jsonResponse(attachment, 201);
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(cardId, userId);
    if (!hasAccess) return errorResponse("Yetkiniz yok", 403);

    const { attachmentId } = await req.json();
    await prisma.attachment.delete({ where: { id: attachmentId } });
    return jsonResponse({ message: "Dosya silindi" });
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}
