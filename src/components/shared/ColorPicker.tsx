"use client";

interface ColorPickerProps {
  selected: string;
  onChange: (color: string) => void;
  colors?: string[];
}

const defaultColors = [
  "#0079bf", "#d29034", "#519839", "#b04632",
  "#89609e", "#cd5a91", "#4bbf6b", "#00aecc",
  "#838c91", "#172b4d",
];

export default function ColorPicker({ selected, onChange, colors = defaultColors }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <button
          key={color}
          onClick={() => onChange(color)}
          className={`w-10 h-8 rounded transition-all ${
            selected === color ? "ring-2 ring-offset-2 ring-blue-500 scale-110" : "hover:scale-105"
          }`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}
