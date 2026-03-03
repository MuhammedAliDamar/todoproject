import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Kullanıcının bir karta (ve dolayısıyla board'a) erişimi olup olmadığını kontrol eder.
 * Kartın board'una üye veya sahip olması gerekir.
 */
export async function verifyCardAccess(cardId: string, userId: string): Promise<boolean> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { list: { select: { board: { select: { userId: true, members: { select: { userId: true } } } } } } },
  });

  if (!card) return false;

  const board = card.list.board;
  if (board.userId === userId) return true;
  return board.members.some((m) => m.userId === userId);
}

/**
 * Kullanıcının bir listeye (ve dolayısıyla board'a) erişimi olup olmadığını kontrol eder.
 */
export async function verifyListAccess(listId: string, userId: string): Promise<boolean> {
  const list = await prisma.list.findUnique({
    where: { id: listId },
    select: { board: { select: { userId: true, members: { select: { userId: true } } } } },
  });

  if (!list) return false;

  const board = list.board;
  if (board.userId === userId) return true;
  return board.members.some((m) => m.userId === userId);
}
