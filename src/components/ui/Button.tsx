"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

const variants = {
  primary: "bg-[var(--asana-accent)] text-white hover:bg-[var(--asana-accent-hover)]",
  secondary: "bg-[var(--asana-bg)] dark:bg-[#1a1a1a] text-[var(--asana-text)] dark:text-white hover:bg-gray-200 dark:hover:bg-[#3a3b3d] border border-[var(--asana-border)]",
  danger: "bg-[var(--asana-accent)] text-white hover:bg-[var(--asana-accent-hover)]",
  ghost: "bg-transparent text-[var(--asana-text-secondary)] hover:text-[var(--asana-text)] dark:hover:text-white hover:bg-[var(--asana-bg)] dark:hover:bg-[#3a3b3d]",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-2.5 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
