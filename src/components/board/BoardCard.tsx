"use client";

import Link from "next/link";

interface BoardCardProps {
  id: string;
  title: string;
  background: string;
  listCount: number;
}

export default function BoardCard({ id, title, background, listCount }: BoardCardProps) {
  return (
    <Link
      href={`/board/${id}`}
      className="block rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow group"
    >
      <div
        className="h-28 p-4 flex flex-col justify-between"
        style={{ backgroundColor: background }}
      >
        <h3 className="text-white font-bold text-lg truncate group-hover:underline">{title}</h3>
        <p className="text-white/80 text-sm">{listCount} liste</p>
      </div>
    </Link>
  );
}
