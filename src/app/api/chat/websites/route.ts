import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;
    const websites = await prisma.website.findMany({
      where: {
        deletedAt: null,
        OR: [{ userId }, { members: { some: { userId, deletedAt: null } } }],
      },
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: {
            conversations: { where: { status: "OPEN" } },
            visitors: true,
          },
        },
      },
    });
    // Site başına bekleyen (operatörün okumadığı) mesaj sayısı
    const waitingRows = websites.length
      ? await prisma.conversation.groupBy({
          by: ["websiteId"],
          where: { websiteId: { in: websites.map((w) => w.id) }, status: "OPEN", operatorUnread: { gt: 0 } },
          _sum: { operatorUnread: true },
        })
      : [];
    const waitingMap = new Map(waitingRows.map((r) => [r.websiteId, r._sum.operatorUnread ?? 0]));

    // Sahip mi üye mi bilgisini + bekleyen sayısını ekle
    return jsonResponse(
      websites.map((w) => ({ ...w, isOwner: w.userId === userId, waiting: waitingMap.get(w.id) ?? 0 }))
    );
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;
    const { name, domain, color, welcomeMessage, operatorName, position } = await req.json();
    if (!name?.trim()) return errorResponse("Site name is required", 400);

    const website = await prisma.website.create({
      data: {
        name: name.trim(),
        domain: domain?.trim() || null,
        color: color || undefined,
        welcomeMessage: welcomeMessage?.trim() || undefined,
        operatorName: operatorName?.trim() || undefined,
        position: position === "left" ? "left" : undefined,
        userId,
      },
    });
    return jsonResponse(website, 201);
  } catch {
    return errorResponse("Server error", 500);
  }
}
