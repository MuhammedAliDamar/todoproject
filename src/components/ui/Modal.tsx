"use client";

import { ReactNode, useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export default function Modal({ isOpen, onClose, children, title, size = "md" }: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`relative bg-[var(--asana-bg-white)] dark:bg-[#2e2f31] rounded-xl shadow-2xl w-full ${sizeClasses[size]} max-h-[80vh] overflow-y-auto z-10 border border-[var(--asana-border)]`}
      >
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-[var(--asana-border)]">
            <h2 className="text-lg font-semibold text-[var(--asana-text)] dark:text-white">{title}</h2>
            <button
              onClick={onClose}
              className="text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)] dark:hover:text-white transition p-1 hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d] rounded"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
