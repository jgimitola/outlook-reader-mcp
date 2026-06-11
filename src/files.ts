import { existsSync } from 'fs';
import { basename, extname, join } from 'path';

/**
 * Attachment names come from the email sender, so they must be treated as
 * untrusted input: strip any path components (prevents `..\` traversal),
 * control characters, and characters Windows rejects in filenames.
 */
export function sanitizeFilename(name: string): string {
  const base = Array.from(basename(name ?? ''))
    .filter((c) => c.charCodeAt(0) >= 32)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/^[. ]+|[. ]+$/g, '');
  return base || 'attachment';
}

/** Returns a path in `dir` that doesn't collide with an existing file. */
export function uniquePath(dir: string, filename: string): string {
  let candidate = join(dir, filename);
  if (!existsSync(candidate)) return candidate;

  const ext = extname(filename);
  const stem = filename.slice(0, filename.length - ext.length);
  for (let i = 1; ; i++) {
    candidate = join(dir, `${stem} (${i})${ext}`);
    if (!existsSync(candidate)) return candidate;
  }
}
