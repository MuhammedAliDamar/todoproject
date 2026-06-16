import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function PUT(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;
    const { newPassword } = await req.json();

    if (!newPassword) {
      return errorResponse("New password is required", 400);
    }
    if (newPassword.length < 8) {
      return errorResponse("Password must be at least 8 characters", 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return errorResponse("User not found", 404);

    await prisma.user.update({
      where: { id: userId },
      data: { password: await hashPassword(newPassword) },
    });

    return jsonResponse({ message: "Password updated" });
  } catch {
    return errorResponse("Server error", 500);
  }
}
