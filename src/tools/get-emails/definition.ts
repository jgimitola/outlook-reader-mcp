import type { Message } from '@microsoft/microsoft-graph-types';

import { getEmails } from '../../mail.js';
import type { Input } from './schema.js';

export const description =
  'Get the full content of multiple emails by their IDs in a single batched request. Much faster than calling get_email repeatedly. Returns subject, sender, recipients, and complete body for each.';

function formatMessage(m: Message): string {
  const from = m.from?.emailAddress;
  const to = (m.toRecipients ?? [])
    .map(
      (r) => `${r.emailAddress?.name ?? ''} <${r.emailAddress?.address ?? ''}>`,
    )
    .join(', ');
  return [
    `ID: ${m.id}`,
    `Subject: ${m.subject ?? '(no subject)'}`,
    `From: ${from?.name ?? ''} <${from?.address ?? ''}>`,
    `To: ${to}`,
    `Date: ${m.receivedDateTime ?? ''}`,
    `Attachments: ${m.hasAttachments ?? false}`,
    `---`,
    m.body?.content ?? '',
  ].join('\n');
}

export async function handler({ ids }: Input) {
  const results = await getEmails(ids);
  const text = results
    .map((r, i) =>
      r.ok
        ? `===== [${i + 1}/${results.length}] =====\n${formatMessage(r.message)}`
        : `===== [${i + 1}/${results.length}] =====\nFailed to fetch ${r.id}: ${r.error}`,
    )
    .join('\n\n');
  return { content: [{ type: 'text' as const, text }] };
}
