import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken } from "@/lib/auth";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return errorResponse("Email and password are required", 400);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return errorResponse("Invalid email or password", 401);
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return errorResponse("Invalid email or password", 401);
    }

    const token = await signToken({ userId: user.id, email: user.email });

    const response = jsonResponse({
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar },
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
    return errorResponse("Server error", 500);
  }
}
