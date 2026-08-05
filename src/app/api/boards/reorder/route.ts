import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/utils";

export async function PUT(req: NextRequest) {
  try {
    const userId = req.headers.get("x-user-id")!;
    const { orderedBoardIds } = await req.json() as { orderedBoardIds: string[] };

    if (!Array.isArray(orderedBoardIds)) {
      return errorResponse("orderedBoardIds must be an array", 400);
    }

    await prisma.$transaction(
      orderedBoardIds.map((boardId, index) =>
        prisma.boardMember.updateMany({
          where: { boardId, userId, deletedAt: null },
          data: { position: index },
        })
      )
    );

    return jsonResponse({ message: "Order updated" });
  } catch {
    return errorResponse("Server error", 500);
  }
}
