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
    // Sahip mi üye mi bilgisini ekle
    return jsonResponse(websites.map((w) => ({ ...w, isOwner: w.userId === userId })));
  } catch {
    return errorResponse("Server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;
    const { name, domain, color, welcomeMessage, operatorName, position } = await req.json();
    if (!name?.trim()) return errorResponse("Site adı gerekli", 400);

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
