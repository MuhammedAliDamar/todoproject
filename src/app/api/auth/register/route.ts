import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return errorResponse("Tüm alanlar gereklidir", 400);
    }

    if (password.length < 8) {
      return errorResponse("Şifre en az 8 karakter olmalıdır", 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return errorResponse("Bu email zaten kullanılıyor", 400);
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    const token = await signToken({ userId: user.id, email: user.email });

    const response = jsonResponse({
      user: { id: user.id, name: user.name, email: user.email },
    });

    const isHttps = process.env.NEXT_PUBLIC_APP_URL?.startsWith("https");
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: !!isHttps,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch {
    return errorResponse("Sunucu hatası", 500);
  }
}
