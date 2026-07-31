import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse, verifyListAccess, getListBoardRole } from "@/lib/utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyListAccess(id, userId);
    if (!hasAccess) return errorResponse("List not found or you don't have permission", 403);

    const data = await req.json();

    const list = await prisma.list.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.position !== undefined && { position: data.position }),
      },
    });

    return jsonResponse(list);
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const role = await getListBoardRole(id, userId);
    if (!role) return errorResponse("List not found or you don't have permission", 403);
    if (role !== "OWNER") return errorResponse("Only the board owner can delete", 403);

    await prisma.list.update({ where: { id }, data: { deletedAt: new Date() } });
    return jsonResponse({ message: "List deleted" });
  } catch {
    return errorResponse("Server error", 500);
  }
}
