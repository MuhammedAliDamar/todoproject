import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const payload = await getUserFromRequest(req);
    if (!payload) {
      return errorResponse("Unauthorized", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, email: true, avatar: true, createdAt: true },
    });

    if (!user) {
      return errorResponse("User not found", 404);
    }

    return jsonResponse({ user });
  } catch {
    return errorResponse("Server error", 500);
  }
}
