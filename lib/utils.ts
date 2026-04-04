import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safe fetch wrapper that handles auth redirects gracefully.
 * When a session expires, the middleware redirects to /login returning HTML.
 * This detects that and throws a clear error instead of a JSON parse failure.
 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const response = await fetch(url, options);
  
  // Detect auth redirect: middleware returns 200 with HTML when redirecting to login
  const contentType = response.headers.get('content-type') || '';
  
  // Only treat as auth redirect if status is 200/302 with HTML — not server errors (5xx)
  if (contentType.includes('text/html') && !url.includes('/api/auth') && response.status < 500) {
    // Check if this is a login redirect
    const redirectUrl = response.url || '';
    if (redirectUrl.includes('/login') || redirectUrl.includes('/signin') || response.redirected) {
      window.location.href = '/login';
      throw new Error('Your session has expired. Redirecting to login...');
    }
    // If it's 401/403 with HTML, treat as auth issue
    if (response.status === 401 || response.status === 403) {
      throw new Error('Session expired or authentication required. Please refresh the page and log in again.');
    }
  }
  
  return response;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}