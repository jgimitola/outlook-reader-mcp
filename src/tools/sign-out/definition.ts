import { clearAuth } from '../../auth.js';
import type { Input } from './schema.js';

export const description =
  'Sign out of the Microsoft account: removes the cached session from this machine and cancels any pending sign-in. After this, the authenticate tool must be run again before other tools work. Note: this clears the local token cache but does not revoke app consent in the Microsoft account.';

export async function handler(_input: Input) {
  const removed = await clearAuth();
  const text =
    removed.length > 0
      ? `Signed out: ${removed.join(', ')}. Run the authenticate tool to sign in again.`
      : 'No cached session found — already signed out.';
  return { content: [{ type: 'text' as const, text }] };
}
