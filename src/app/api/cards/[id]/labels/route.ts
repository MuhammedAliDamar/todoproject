import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse, verifyCardAccess } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(cardId, userId);
    if (!hasAccess) return errorResponse("You don't have permission", 403);

    const { labelId } = await req.json();

    const existing = await prisma.cardLabel.findUnique({
      where: { cardId_labelId: { cardId, labelId } },
    });

    if (existing && !existing.deletedAt) {
      await prisma.cardLabel.update({
        where: { cardId_labelId: { cardId, labelId } },
        data: { deletedAt: new Date() },
      });
      return jsonResponse({ removed: true });
    }

    if (existing && existing.deletedAt) {
      await prisma.cardLabel.update({
        where: { cardId_labelId: { cardId, labelId } },
        data: { deletedAt: null },
      });
      return jsonResponse({ added: true }, 201);
    }

    await prisma.cardLabel.create({ data: { cardId, labelId } });
    return jsonResponse({ added: true }, 201);
  } catch {
    return errorResponse("Server error", 500);
  }
}
