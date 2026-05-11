import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Checks whether the user has access to a card (and therefore its board).
 * Requires the user to be a member or owner of the card's board.
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
 * Checks whether the user has access to a list (and therefore its board).
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
