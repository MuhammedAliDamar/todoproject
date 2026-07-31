import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export type BoardRole = "OWNER" | "MEMBER" | "VIEWER";

/**
 * Returns the user's role on a board, or null if they have no access.
 * The board creator (board.userId) is always treated as OWNER.
 */
export async function getBoardRole(boardId: string, userId: string): Promise<BoardRole | null> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { userId: true, deletedAt: true, members: { where: { userId, deletedAt: null }, select: { role: true } } },
  });
  if (board?.deletedAt) return null;

  if (!board) return null;
  if (board.userId === userId) return "OWNER";

  const member = board.members[0];
  return member ? (member.role as BoardRole) : null;
}

/** Returns the user's role on the board that owns the given card. */
export async function getCardBoardRole(cardId: string, userId: string): Promise<BoardRole | null> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { list: { select: { boardId: true } } },
  });
  if (!card) return null;
  return getBoardRole(card.list.boardId, userId);
}

/** Returns the user's role on the board that owns the given list. */
export async function getListBoardRole(listId: string, userId: string): Promise<BoardRole | null> {
  const list = await prisma.list.findUnique({
    where: { id: listId },
    select: { boardId: true },
  });
  if (!list) return null;
  return getBoardRole(list.boardId, userId);
}

/**
 * Checks whether the user has access to a card (and therefore its board).
 * Requires the user to be a member or owner of the card's board.
 */
export async function verifyCardAccess(cardId: string, userId: string): Promise<boolean> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { deletedAt: true, list: { select: { deletedAt: true, board: { select: { userId: true, deletedAt: true, members: { where: { deletedAt: null }, select: { userId: true } } } } } } },
  });

  if (!card || card.deletedAt || card.list.deletedAt || card.list.board.deletedAt) return false;

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
    select: { deletedAt: true, board: { select: { userId: true, deletedAt: true, members: { where: { deletedAt: null }, select: { userId: true } } } } },
  });

  if (!list || list.deletedAt || list.board.deletedAt) return false;

  const board = list.board;
  if (board.userId === userId) return true;
  return board.members.some((m) => m.userId === userId);
}
