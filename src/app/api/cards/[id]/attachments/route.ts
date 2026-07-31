import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse, verifyCardAccess, getCardBoardRole } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(cardId, userId);
    if (!hasAccess) return errorResponse("You don't have permission", 403);

    const { filename, url } = await req.json();

    if (!filename || !url) {
      return errorResponse("Filename and URL are required", 400);
    }

    // Restrict URL to local uploads only
    if (!url.startsWith("/uploads/")) {
      return errorResponse("Invalid file URL", 400);
    }

    const attachment = await prisma.attachment.create({
      data: { filename, url, cardId },
    });

    return jsonResponse(attachment, 201);
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const role = await getCardBoardRole(cardId, userId);
    if (!role) return errorResponse("You don't have permission", 403);
    if (role !== "OWNER") return errorResponse("Only the board owner can delete", 403);

    const { attachmentId } = await req.json();
    await prisma.attachment.update({ where: { id: attachmentId }, data: { deletedAt: new Date() } });
    return jsonResponse({ message: "File deleted" });
  } catch {
    return errorResponse("Server error", 500);
  }
}
