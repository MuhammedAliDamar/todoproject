"use client";

interface BadgeProps {
  color: string;
  name?: string;
  size?: "sm" | "md";
  onClick?: () => void;
  removable?: boolean;
  onRemove?: () => void;
}

export default function Badge({ color, name, size = "md", onClick, removable, onRemove }: BadgeProps) {
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium text-white ${sizeClass} ${onClick ? "cursor-pointer hover:opacity-80" : ""}`}
      style={{ backgroundColor: color }}
      onClick={onClick}
    >
      {name && <span>{name}</span>}
      {removable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="ml-1 hover:bg-black/20 rounded-full w-4 h-4 flex items-center justify-center"
        >
          x
        </button>
      )}
    </span>
  );
}
