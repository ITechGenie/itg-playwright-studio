import * as short from 'short-uuid';

/**
 * Generate a short, unique ID for project or other resources.
 */
export function generateId(): string {
  return short.generate();
}
