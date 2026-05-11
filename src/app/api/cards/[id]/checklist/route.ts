import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse, verifyCardAccess } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(cardId, userId);
    if (!hasAccess) return errorResponse("You don't have permission", 403);

    const { title, itemContent, checklistId, itemId, isCompleted } = await req.json();

    // Create new checklist
    if (title) {
      const checklist = await prisma.checklist.create({
        data: { title, cardId },
        include: { items: true },
      });
      return jsonResponse(checklist, 201);
    }

    // Add item to checklist
    if (itemContent && checklistId) {
      const item = await prisma.checklistItem.create({
        data: { content: itemContent, checklistId },
      });
      return jsonResponse(item, 201);
    }

    // Toggle item completion
    if (itemId !== undefined && isCompleted !== undefined) {
      const item = await prisma.checklistItem.update({
        where: { id: itemId },
        data: { isCompleted },
      });
      return jsonResponse(item);
    }

    return errorResponse("Invalid request", 400);
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: cardId } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyCardAccess(cardId, userId);
    if (!hasAccess) return errorResponse("You don't have permission", 403);

    const { checklistId, itemId } = await req.json();

    if (itemId) {
      await prisma.checklistItem.delete({ where: { id: itemId } });
    } else if (checklistId) {
      await prisma.checklist.delete({ where: { id: checklistId } });
    }

    return jsonResponse({ message: "Deleted" });
  } catch {
    return errorResponse("Server error", 500);
  }
}
