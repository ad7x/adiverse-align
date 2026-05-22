import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function extractPlainText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) {
    return node.map(extractPlainText).join(' ');
  }
  if (node.text) return node.text;
  if (node.content) {
    return extractPlainText(node.content);
  }
  return '';
}
