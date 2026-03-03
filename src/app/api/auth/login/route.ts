import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken } from "@/lib/auth";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return errorResponse("Email ve şifre gereklidir", 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return errorResponse("Geçersiz email veya şifre", 401);
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return errorResponse("Geçersiz email veya şifre", 401);
    }

    const token = await signToken({ userId: user.id, email: user.email });

    const response = jsonResponse({
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}
