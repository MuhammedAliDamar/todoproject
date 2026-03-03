import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return jsonResponse(notifications);
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return jsonResponse({ message: "Tüm bildirimler okundu" });
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}
