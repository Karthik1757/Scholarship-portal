import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getStoragePath(url: string): string | null {
  try {
    // Supabase public URLs typically look like: .../storage/v1/object/public/bucket_name/path/to/file
    // We need to extract 'path/to/file'
    const parts = url.split('/documents/');
    if (parts.length < 2) return null;
    // Decode URI component in case of spaces or special chars
    return decodeURIComponent(parts[1]);
  } catch (e) {
    console.error("Error parsing storage URL:", e);
    return null;
  }
}
