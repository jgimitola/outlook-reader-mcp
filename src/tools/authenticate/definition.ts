import { getSignedInAccount, startDeviceCodeAuth } from '../../auth.js';
import type { Input } from './schema.js';

export const description =
  'Sign in to the Microsoft account used by the other tools. Returns a URL and a one-time code: show both to the user and tell them to complete the sign-in in their browser. Run this when other tools report that authentication is required. Safe to call anytime — reports the current account if already signed in.';

export async function handler(_input: Input) {
  const account = await getSignedInAccount();
  if (account) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Already signed in as ${account}. Other tools are ready to use.`,
        },
      ],
    };
  }

  const verification = await startDeviceCodeAuth();
  return {
    content: [
      {
        type: 'text' as const,
        text:
          `${verification}\n\n` +
          'Show the URL and code to the user and ask them to complete the sign-in ' +
          'in their browser. Once done, retry the original request — no need to ' +
          'run this tool again.',
      },
    ],
  };
}
