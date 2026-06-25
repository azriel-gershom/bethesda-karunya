/**
 * Bethesda Portal — API Configuration
 *
 * Resolves the backend API base URL from the Vite environment variable
 * VITE_API_URL. Falls back to an empty string so that same-domain
 * local development (Vite proxy / Express middleware) continues to work
 * without any environment variable set.
 *
 * Usage:
 *   import { API_URL } from '@/src/config/api';
 *   fetch(`${API_URL}/api/queue`, { ... });
 *   const socket = io(API_URL);
 */

export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? '';
