import { listAttachments } from '../../mail.js';
import type { Input } from './schema.js';

export const description =
  'List all attachments for a specific email. Returns attachment IDs, names, sizes, and content types. Use download_attachment for one file, or download_attachments to save several (or all) in a single call.';

export async function handler({ messageId }: Input) {
  const attachments = await listAttachments(messageId);
  if (attachments.length === 0) {
    return {
      content: [{ type: 'text' as const, text: 'No attachments found.' }],
    };
  }
  const text = attachments
    .map((a, i) =>
      [
        `[${i + 1}] ID: ${a.id}`,
        `    Name: ${a.name}`,
        `    Size: ${(a.size / 1024).toFixed(1)} KB`,
        `    Type: ${a.contentType}`,
        `    Inline: ${a.isInline}`,
      ].join('\n'),
    )
    .join('\n\n');
  return { content: [{ type: 'text' as const, text }] };
}
