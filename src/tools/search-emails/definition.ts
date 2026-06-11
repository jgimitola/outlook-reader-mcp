import { searchEmails } from '../../mail.js';
import type { Input } from './schema.js';

export const description =
  'Search emails using a keyword query. Searches across subject, body, sender, and recipients.';

export async function handler({ query, top }: Input) {
  const emails = await searchEmails(query, top);
  const text = emails
    .map((m, i) => {
      const from = m.from?.emailAddress;
      return [
        `[${i + 1}] ID: ${m.id}`,
        `    Subject: ${m.subject ?? '(no subject)'}`,
        `    From: ${from?.name ?? ''} <${from?.address ?? ''}>`,
        `    Date: ${m.receivedDateTime ?? ''}`,
        `    Preview: ${(m.bodyPreview ?? '').slice(0, 150)}`,
      ].join('\n');
    })
    .join('\n\n');
  return {
    content: [{ type: 'text' as const, text: text || 'No results found.' }],
  };
}
