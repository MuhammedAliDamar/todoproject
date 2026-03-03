"use client";

interface Label {
  id: string;
  name: string;
  color: string;
}

interface LabelPickerProps {
  boardLabels: Label[];
  activeLabels: string[];
  onToggle: (labelId: string) => void;
}

export default function LabelPicker({ boardLabels, activeLabels, onToggle }: LabelPickerProps) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Etiketler</h4>
      {boardLabels.map((label) => {
        const isActive = activeLabels.includes(label.id);
        return (
          <button
            key={label.id}
            onClick={() => onToggle(label.id)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
              isActive ? "ring-2 ring-blue-500" : "hover:bg-gray-50 dark:hover:bg-gray-600"
            }`}
          >
            <span className="w-8 h-5 rounded" style={{ backgroundColor: label.color }} />
            <span className="text-gray-700 dark:text-gray-300">{label.name}</span>
            {isActive && (
              <svg className="w-4 h-4 ml-auto text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
