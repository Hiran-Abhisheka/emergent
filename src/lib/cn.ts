import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class names and resolves Tailwind conflicts (last one wins).
 * Thin wrapper over clsx + tailwind-merge, the standard shadcn-style idiom.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
