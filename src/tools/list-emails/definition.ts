import { listEmails } from '../../mail.js';
import type { Input } from './schema.js';

export const description =
  'List emails from an Outlook mailbox folder. Supports filtering by read status, sender, date range, and more using OData filter syntax. Use skip to page through results.';

export async function handler({ folder, top, skip, filter, orderby }: Input) {
  const emails = await listEmails({ folder, top, skip, filter, orderby });
  const text = emails
    .map((m, i) => {
      const from = m.from?.emailAddress;
      return [
        `[${(skip ?? 0) + i + 1}] ID: ${m.id}`,
        `    Subject: ${m.subject ?? '(no subject)'}`,
        `    From: ${from?.name ?? ''} <${from?.address ?? ''}>`,
        `    Date: ${m.receivedDateTime ?? ''}`,
        `    Read: ${m.isRead} | Attachments: ${m.hasAttachments ?? false}`,
        `    Preview: ${(m.bodyPreview ?? '').slice(0, 150)}`,
      ].join('\n');
    })
    .join('\n\n');

  const footer =
    emails.length === top
      ? `\n\n(Showing ${emails.length} results — more may exist. Use skip=${(skip ?? 0) + top} for the next page.)`
      : '';

  return {
    content: [
      {
        type: 'text' as const,
        text: text ? text + footer : 'No emails found.',
      },
    ],
  };
}
