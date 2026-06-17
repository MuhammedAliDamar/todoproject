import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) return errorResponse("Token and new password are required", 400);
    if (newPassword.length < 8) return errorResponse("Password must be at least 8 characters", 400);

    const reset = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!reset || reset.used || reset.expiresAt < new Date()) {
      return errorResponse("Invalid or expired reset link", 400);
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: reset.userId },
        data: { password: await hashPassword(newPassword) },
      }),
      prisma.passwordResetToken.update({
        where: { id: reset.id },
        data: { used: true },
      }),
    ]);

    return jsonResponse({ message: "Password reset successfully" });
  } catch {
    return errorResponse("Server error", 500);
  }
}
