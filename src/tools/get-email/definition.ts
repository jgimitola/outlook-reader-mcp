import { getEmail } from '../../mail.js';
import type { Input } from './schema.js';

export const description =
  'Get the full content of a specific email by its ID, including the complete body. To fetch several emails at once, use get_emails instead.';

export async function handler({ id }: Input) {
  const m = await getEmail(id);
  const from = m.from?.emailAddress;
  const to = (m.toRecipients ?? [])
    .map(
      (r) => `${r.emailAddress?.name ?? ''} <${r.emailAddress?.address ?? ''}>`,
    )
    .join(', ');

  // Graph returns plain text thanks to the Prefer header; the regex strip is
  // only a fallback in case the header is ignored.
  const body = m.body?.content ?? '';
  const plainBody =
    m.body?.contentType === 'html'
      ? body
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : body;

  const text = [
    `ID: ${m.id}`,
    `Subject: ${m.subject ?? '(no subject)'}`,
    `From: ${from?.name ?? ''} <${from?.address ?? ''}>`,
    `To: ${to}`,
    `Date: ${m.receivedDateTime ?? ''}`,
    `Attachments: ${m.hasAttachments ?? false}`,
    `---`,
    plainBody,
  ].join('\n');

  return { content: [{ type: 'text' as const, text }] };
}
