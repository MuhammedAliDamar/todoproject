import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";
import { sendMail } from "@/lib/mail";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return errorResponse("Email is required", 400);

    const user = await prisma.user.findUnique({ where: { email } });

    // Hesap olup olmadığını sızdırmamak için her durumda başarı dön
    if (user) {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 saat

      await prisma.passwordResetToken.create({
        data: { token, userId: user.id, expiresAt },
      });

      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
      await sendMail(
        email,
        "Reset your marktasks password",
        `<p>Hi ${user.name},</p>
         <p>We received a request to reset your password. Click the link below (valid for 1 hour):</p>
         <p><a href="${resetUrl}">${resetUrl}</a></p>
         <p>If you didn't request this, you can ignore this email.</p>`
      );
    }

    return jsonResponse({ message: "If an account exists, a reset link has been sent" });
  } catch {
    return errorResponse("Server error", 500);
  }
}
