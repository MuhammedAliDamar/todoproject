import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse, verifyListAccess } from "@/lib/utils";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyListAccess(id, userId);
    if (!hasAccess) return errorResponse("Liste bulunamadı veya yetkiniz yok", 403);

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
    return errorResponse("Sunucu hatası", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = req.headers.get("x-user-id")!;

    const hasAccess = await verifyListAccess(id, userId);
    if (!hasAccess) return errorResponse("Liste bulunamadı veya yetkiniz yok", 403);

    await prisma.list.delete({ where: { id } });
    return jsonResponse({ message: "Liste silindi" });
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}
