/**
 * Centralized cache invalidation for all API config caches.
 * Call invalidateAllApiCaches() after any admin config change
 * to ensure subsequent API calls pick up the new values immediately.
 */

import { invalidateLlmCache } from '@/lib/llm';
import { invalidateImagenCache } from '@/lib/imagen';
import { invalidateMovieStyleCache } from '@/lib/movie-style-ref';

/** Bust every in-memory API / config cache in the process */
export function invalidateAllApiCaches() {
  invalidateLlmCache();
  invalidateImagenCache();
  invalidateMovieStyleCache();
  console.log('[cache] All API config caches invalidated');
}
